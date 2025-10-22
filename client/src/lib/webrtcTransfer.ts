import { EventEmitter } from 'events';

export interface WebRTCTransferConfig {
  iceServers: RTCIceServer[];
  chunkSize: number;
  maxRetries: number;
}

export interface TransferProgress {
  fileId: string;
  fileName: string;
  fileSize: number;
  bytesTransferred: number;
  percentage: number;
  speed: number;
  eta: number;
  status: 'connecting' | 'transferring' | 'completed' | 'error' | 'paused';
}

export class WebRTCTransfer extends EventEmitter {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private config: WebRTCTransferConfig;
  private transferState: Map<string, any> = new Map();
  private isConnected = false;

  constructor(config: WebRTCTransferConfig) {
    super();
    this.config = config;
  }

  // Initialize P2P connection
  async initializeConnection(): Promise<void> {
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers
    });

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit('ice-candidate', event.candidate);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      this.isConnected = state === 'connected';
      this.emit('connection-state-change', state);
    };

    // Create data channel for file transfer
    this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', {
      ordered: true,
      maxRetransmits: 3
    });

    this.setupDataChannel();
  }

  private setupDataChannel(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('[WebRTC] Data channel opened');
      this.emit('data-channel-open');
    };

    this.dataChannel.onclose = () => {
      console.log('[WebRTC] Data channel closed');
      this.emit('data-channel-close');
    };

    this.dataChannel.onerror = (error) => {
      console.error('[WebRTC] Data channel error:', error);
      this.emit('data-channel-error', error);
    };

    this.dataChannel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data);
    };
  }

  private handleDataChannelMessage(data: any): void {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'file-info':
          this.emit('file-info', message.data);
          break;
        case 'file-chunk':
          this.emit('file-chunk', message.data);
          break;
        case 'chunk-ack':
          this.emit('chunk-ack', message.data);
          break;
        case 'transfer-complete':
          this.emit('transfer-complete', message.data);
          break;
        case 'transfer-resume':
          this.emit('transfer-resume', message.data);
          break;
        default:
          console.warn('[WebRTC] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[WebRTC] Failed to parse message:', error);
    }
  }

  // Send file with resume capability
  async sendFile(file: File, resumeFrom: number = 0): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    const fileId = this.generateFileId();
    const totalChunks = Math.ceil(file.size / this.config.chunkSize);
    
    // Send file info
    this.sendMessage({
      type: 'file-info',
      data: {
        fileId,
        fileName: file.name,
        fileSize: file.size,
        totalChunks,
        resumeFrom
      }
    });

    // Send file chunks
    for (let i = resumeFrom; i < totalChunks; i++) {
      const start = i * this.config.chunkSize;
      const end = Math.min(start + this.config.chunkSize, file.size);
      const chunk = file.slice(start, end);
      
      await this.sendChunk(fileId, i, chunk, totalChunks);
      
      // Emit progress
      const progress = ((i + 1) / totalChunks) * 100;
      this.emit('progress', {
        fileId,
        percentage: progress,
        bytesTransferred: end,
        totalBytes: file.size
      });
    }

    // Send completion
    this.sendMessage({
      type: 'transfer-complete',
      data: { fileId }
    });
  }

  private async sendChunk(fileId: string, chunkIndex: number, chunk: Blob, totalChunks: number): Promise<void> {
    const arrayBuffer = await chunk.arrayBuffer();
    const base64Chunk = this.arrayBufferToBase64(arrayBuffer);
    
    this.sendMessage({
      type: 'file-chunk',
      data: {
        fileId,
        chunkIndex,
        chunk: base64Chunk,
        totalChunks,
        chunkSize: chunk.size
      }
    });
  }

  private sendMessage(message: any): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(message));
    }
  }

  // Resume interrupted transfer
  async resumeTransfer(fileId: string, resumeFrom: number): Promise<void> {
    this.sendMessage({
      type: 'transfer-resume',
      data: { fileId, resumeFrom }
    });
  }

  // Handle incoming ICE candidate
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.peerConnection) {
      await this.peerConnection.addIceCandidate(candidate);
    }
  }

  // Create offer for connection
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    return await this.peerConnection.createOffer();
  }

  // Create answer for connection
  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    return await this.peerConnection.createAnswer();
  }

  // Set remote description
  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(description);
    }
  }

  // Set local description
  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (this.peerConnection) {
      await this.peerConnection.setLocalDescription(description);
    }
  }

  // Utility functions
  private generateFileId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Cleanup
  destroy(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    this.removeAllListeners();
  }
}
