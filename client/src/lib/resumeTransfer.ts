// Browser-compatible EventEmitter implementation
class EventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, listener: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  emit(event: string, ...args: any[]) {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(...args));
    }
  }

  off(event: string, listener: Function) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
  }
}

export interface TransferState {
  fileId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  completedChunks: Set<number>;
  failedChunks: Set<number>;
  startTime: number;
  lastUpdate: number;
  checksum: string;
  metadata: {
    type: string;
    lastModified: number;
    permissions?: string;
  };
}

export interface ResumeInfo {
  fileId: string;
  completedChunks: number[];
  failedChunks: number[];
  checksum: string;
  lastChunkIndex: number;
}

export class ResumeTransfer extends EventEmitter {
  private transferStates: Map<string, TransferState> = new Map();
  private storageKey = 'sharezidi-transfer-states';

  constructor() {
    super();
    this.loadTransferStates();
  }

  // Create new transfer state
  createTransferState(
    fileId: string,
    fileName: string,
    fileSize: number,
    totalChunks: number,
    checksum: string,
    metadata: any
  ): TransferState {
    const transferState: TransferState = {
      fileId,
      fileName,
      fileSize,
      totalChunks,
      completedChunks: new Set(),
      failedChunks: new Set(),
      startTime: Date.now(),
      lastUpdate: Date.now(),
      checksum,
      metadata
    };

    this.transferStates.set(fileId, transferState);
    this.saveTransferStates();
    
    this.emit('transfer-created', transferState);
    return transferState;
  }

  // Update chunk completion
  updateChunkCompleted(fileId: string, chunkIndex: number): void {
    const state = this.transferStates.get(fileId);
    if (!state) return;

    state.completedChunks.add(chunkIndex);
    state.failedChunks.delete(chunkIndex);
    state.lastUpdate = Date.now();

    this.saveTransferStates();
    this.emit('chunk-completed', { fileId, chunkIndex, state });
  }

  // Update chunk failure
  updateChunkFailed(fileId: string, chunkIndex: number): void {
    const state = this.transferStates.get(fileId);
    if (!state) return;

    state.failedChunks.add(chunkIndex);
    state.completedChunks.delete(chunkIndex);
    state.lastUpdate = Date.now();

    this.saveTransferStates();
    this.emit('chunk-failed', { fileId, chunkIndex, state });
  }

  // Get resume information
  getResumeInfo(fileId: string): ResumeInfo | null {
    const state = this.transferStates.get(fileId);
    if (!state) return null;

    return {
      fileId,
      completedChunks: Array.from(state.completedChunks),
      failedChunks: Array.from(state.failedChunks),
      checksum: state.checksum,
      lastChunkIndex: Math.max(...Array.from(state.completedChunks), -1)
    };
  }

  // Check if transfer can be resumed
  canResume(fileId: string, currentChecksum: string): boolean {
    const state = this.transferStates.get(fileId);
    if (!state) return false;

    // Check if checksum matches
    if (state.checksum !== currentChecksum) {
      console.log('[ResumeTransfer] Checksum mismatch, cannot resume');
      return false;
    }

    // Check if transfer is not too old (24 hours)
    const age = Date.now() - state.startTime;
    if (age > 24 * 60 * 60 * 1000) {
      console.log('[ResumeTransfer] Transfer too old, cannot resume');
      return false;
    }

    // Check if there are incomplete chunks
    const totalChunks = state.totalChunks;
    const completedChunks = state.completedChunks.size;
    
    return completedChunks < totalChunks;
  }

  // Get chunks to resume
  getChunksToResume(fileId: string): number[] {
    const state = this.transferStates.get(fileId);
    if (!state) return [];

    const chunksToResume: number[] = [];
    
    // Add failed chunks
    chunksToResume.push(...Array.from(state.failedChunks));
    
    // Add missing chunks
    for (let i = 0; i < state.totalChunks; i++) {
      if (!state.completedChunks.has(i)) {
        chunksToResume.push(i);
      }
    }

    return chunksToResume.sort((a, b) => a - b);
  }

  // Get transfer progress
  getTransferProgress(fileId: string): {
    percentage: number;
    completedChunks: number;
    totalChunks: number;
    failedChunks: number;
    speed: number;
    eta: number;
  } | null {
    const state = this.transferStates.get(fileId);
    if (!state) return null;

    const completedChunks = state.completedChunks.size;
    const totalChunks = state.totalChunks;
    const percentage = (completedChunks / totalChunks) * 100;
    
    const elapsed = Date.now() - state.startTime;
    const speed = completedChunks / (elapsed / 1000); // chunks per second
    const remainingChunks = totalChunks - completedChunks;
    const eta = remainingChunks / speed; // seconds

    return {
      percentage,
      completedChunks,
      totalChunks,
      failedChunks: state.failedChunks.size,
      speed,
      eta: isFinite(eta) ? eta : 0
    };
  }

  // Complete transfer
  completeTransfer(fileId: string): void {
    const state = this.transferStates.get(fileId);
    if (!state) return;

    // Verify all chunks are completed
    if (state.completedChunks.size === state.totalChunks) {
      this.transferStates.delete(fileId);
      this.saveTransferStates();
      this.emit('transfer-completed', { fileId, state });
    } else {
      console.warn('[ResumeTransfer] Cannot complete transfer, not all chunks finished');
    }
  }

  // Cancel transfer
  cancelTransfer(fileId: string): void {
    const state = this.transferStates.get(fileId);
    if (state) {
      this.transferStates.delete(fileId);
      this.saveTransferStates();
      this.emit('transfer-cancelled', { fileId, state });
    }
  }

  // Get all active transfers
  getActiveTransfers(): TransferState[] {
    return Array.from(this.transferStates.values());
  }

  // Clean up old transfers
  cleanupOldTransfers(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [fileId, state] of this.transferStates.entries()) {
      if (now - state.lastUpdate > maxAge) {
        this.transferStates.delete(fileId);
        console.log(`[ResumeTransfer] Cleaned up old transfer: ${fileId}`);
      }
    }

    this.saveTransferStates();
  }

  // Calculate file checksum
  async calculateChecksum(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Verify file integrity
  async verifyFileIntegrity(file: File, expectedChecksum: string): Promise<boolean> {
    const actualChecksum = await this.calculateChecksum(file);
    return actualChecksum === expectedChecksum;
  }

  // Save transfer states to localStorage
  private saveTransferStates(): void {
    try {
      const states = Array.from(this.transferStates.entries()).map(([fileId, state]) => ({
        fileId,
        ...state,
        completedChunks: Array.from(state.completedChunks),
        failedChunks: Array.from(state.failedChunks)
      }));

      localStorage.setItem(this.storageKey, JSON.stringify(states));
    } catch (error) {
      console.error('[ResumeTransfer] Failed to save transfer states:', error);
    }
  }

  // Load transfer states from localStorage
  private loadTransferStates(): void {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (!saved) return;

      const states = JSON.parse(saved);
      states.forEach((state: any) => {
        this.transferStates.set(state.fileId, {
          ...state,
          completedChunks: new Set(state.completedChunks),
          failedChunks: new Set(state.failedChunks)
        });
      });

      console.log(`[ResumeTransfer] Loaded ${states.length} transfer states`);
    } catch (error) {
      console.error('[ResumeTransfer] Failed to load transfer states:', error);
    }
  }

  // Get transfer statistics
  getTransferStatistics(): {
    totalTransfers: number;
    completedTransfers: number;
    activeTransfers: number;
    totalDataTransferred: number;
  } {
    const activeTransfers = this.transferStates.size;
    const completedTransfers = 0; // This would be tracked separately
    const totalTransfers = activeTransfers + completedTransfers;
    const totalDataTransferred = 0; // This would be calculated from completed transfers

    return {
      totalTransfers,
      completedTransfers,
      activeTransfers,
      totalDataTransferred
    };
  }
}
