export interface Device {
  id: string;
  name: string;
  type: 'mobile' | 'laptop' | 'tablet' | 'pc';
  online: boolean;
  lastSeen?: Date;
}

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  totalChunks: number;
  chunkSize: number;
}

export interface TransferProgress {
  deviceId: string;
  fileInfo: FileInfo;
  sentProgress: number;
  receivedProgress: number;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'stalled';
  duplicateChunks: number;
  missingChunks: number[];
  isTransferring: boolean;
  error?: string;
}

export interface ChunkData {
  chunkIndex: number;
  data: ArrayBuffer;
  fileId: string;
  totalChunks: number;
}

export interface TransferRequest {
  fromUserId: string;
  toUserId: string;
  fileInfo: FileInfo;
}

export interface TransferResponse {
  accepted: boolean;
  reason?: string;
}

export interface SyncStatus {
  senderId: string;
  receiverId: string;
  fileId: string;
  senderProgress: number;
  receiverProgress: number;
  syncLag: number;
  duplicatesRejected: number;
  lastChunkTime: number;
}
