export class LargeFileTransfer {
  private static readonly MAX_CHUNK_SIZE = 1024 * 1024; // 1MB max chunk
  private static readonly MAX_PARALLEL_STREAMS = 2; // Conservative for large files
  private static readonly CONNECTION_TIMEOUT = 60000; // 1 minute per chunk
  private static readonly MAX_RETRIES = 5;
  private static readonly HEARTBEAT_INTERVAL = 5000; // 5 seconds

  static getOptimizedSettings(fileSize: number) {
    const settings = {
      chunkSize: this.calculateChunkSize(fileSize),
      parallelStreams: this.calculateParallelStreams(fileSize),
      timeout: this.calculateTimeout(fileSize),
      heartbeatInterval: this.HEARTBEAT_INTERVAL
    };

    console.log(`[LargeFileTransfer] Optimized settings for ${(fileSize / 1024 / 1024).toFixed(1)}MB:`, settings);
    return settings;
  }

  private static calculateChunkSize(fileSize: number): number {
    if (fileSize < 10 * 1024 * 1024) return 64 * 1024; // 64KB for < 10MB
    if (fileSize < 100 * 1024 * 1024) return 256 * 1024; // 256KB for < 100MB
    if (fileSize < 500 * 1024 * 1024) return 512 * 1024; // 512KB for < 500MB
    return this.MAX_CHUNK_SIZE; // 1MB for huge files
  }

  private static calculateParallelStreams(fileSize: number): number {
    // Very conservative approach for large files to prevent WebSocket overwhelm
    if (fileSize > 500 * 1024 * 1024) return 1; // Single stream for 500MB+
    if (fileSize > 100 * 1024 * 1024) return 2; // Two streams for 100MB+
    return 3; // Three streams for smaller files
  }

  private static calculateTimeout(fileSize: number): number {
    // Base timeout of 2 minutes, +30 seconds per 100MB
    const baseTimeout = 120000; // 2 minutes
    const additionalTime = Math.floor(fileSize / (100 * 1024 * 1024)) * 30000; // 30s per 100MB
    return Math.min(baseTimeout + additionalTime, 1800000); // Cap at 30 minutes
  }

  static createProgressTracker(fileSize: number, totalChunks: number) {
    return {
      startTime: Date.now(),
      lastProgressTime: Date.now(),
      bytesTransferred: 0,
      chunksTransferred: 0,
      totalChunks,
      fileSize,
      retryCount: 0,
      stalled: false,
      
      updateProgress(chunkIndex: number, chunkSize: number) {
        this.chunksTransferred = chunkIndex + 1;
        this.bytesTransferred += chunkSize;
        this.lastProgressTime = Date.now();
        this.stalled = false;
        
        return {
          percentage: (this.chunksTransferred / this.totalChunks) * 100,
          speed: this.calculateSpeed(),
          eta: this.calculateETA()
        };
      },
      
      calculateSpeed() {
        const elapsed = Date.now() - this.startTime;
        if (elapsed === 0) return 0;
        return (this.bytesTransferred / elapsed) * 1000; // bytes per second
      },
      
      calculateETA() {
        const speed = this.calculateSpeed();
        if (speed === 0) return 0;
        const remainingBytes = this.fileSize - this.bytesTransferred;
        return remainingBytes / speed; // seconds
      },
      
      checkStalled() {
        const timeSinceProgress = Date.now() - this.lastProgressTime;
        this.stalled = timeSinceProgress > 30000; // 30 seconds without progress
        return this.stalled;
      }
    };
  }

  static async sendChunkWithRetry(
    websocket: any,
    chunkData: ArrayBuffer,
    chunkIndex: number,
    fileId: string,
    toUserId: string,
    maxRetries: number = this.MAX_RETRIES
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const success = await this.sendChunkOnce(websocket, chunkData, chunkIndex, fileId, toUserId);
        if (success) return true;
        
        console.warn(`[LargeFileTransfer] Chunk ${chunkIndex} attempt ${attempt} failed, retrying...`);
        
        if (attempt < maxRetries) {
          // Exponential backoff with jitter
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`[LargeFileTransfer] Chunk ${chunkIndex} attempt ${attempt} error:`, error);
      }
    }
    
    console.error(`[LargeFileTransfer] Failed to send chunk ${chunkIndex} after ${maxRetries} attempts`);
    return false;
  }

  private static async sendChunkOnce(
    websocket: any,
    chunkData: ArrayBuffer,
    chunkIndex: number,
    fileId: string,
    toUserId: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn(`[LargeFileTransfer] Chunk ${chunkIndex} send timeout`);
        resolve(false);
      }, this.CONNECTION_TIMEOUT);

      try {
        // Convert to Base64 for WebSocket transmission
        const bytes = new Uint8Array(chunkData);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Chunk = btoa(binary);

        const success = websocket.send('file-chunk', {
          toUserId,
          fileId,
          chunkIndex,
          chunk: base64Chunk,
          chunkSize: chunkData.byteLength
        });

        clearTimeout(timeout);
        resolve(success);
      } catch (error) {
        clearTimeout(timeout);
        console.error(`[LargeFileTransfer] Error sending chunk ${chunkIndex}:`, error);
        resolve(false);
      }
    });
  }

  static createConnectionMonitor(websocket: any, onConnectionLost: () => void) {
    let heartbeatInterval: NodeJS.Timeout;
    let missedHeartbeats = 0;
    const maxMissedHeartbeats = 3;

    const startHeartbeat = () => {
      heartbeatInterval = setInterval(() => {
        if (!websocket.isConnected) {
          console.warn('[LargeFileTransfer] Connection lost during transfer');
          onConnectionLost();
          return;
        }

        // Send ping and expect pong
        const pingSent = websocket.send('ping', { timestamp: Date.now() });
        if (!pingSent) {
          missedHeartbeats++;
          console.warn(`[LargeFileTransfer] Failed to send ping, missed: ${missedHeartbeats}`);
          
          if (missedHeartbeats >= maxMissedHeartbeats) {
            console.error('[LargeFileTransfer] Too many missed heartbeats, connection unstable');
            onConnectionLost();
          }
        } else {
          missedHeartbeats = 0;
        }
      }, this.HEARTBEAT_INTERVAL);
    };

    const stopHeartbeat = () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
    };

    return { startHeartbeat, stopHeartbeat };
  }

  static formatTransferStats(tracker: any) {
    const speed = tracker.calculateSpeed();
    const eta = tracker.calculateETA();
    
    return {
      speed: this.formatSpeed(speed),
      eta: this.formatTime(eta),
      percentage: ((tracker.chunksTransferred / tracker.totalChunks) * 100).toFixed(1),
      transferred: this.formatBytes(tracker.bytesTransferred),
      total: this.formatBytes(tracker.fileSize)
    };
  }

  private static formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  }

  private static formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(0)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  private static formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}