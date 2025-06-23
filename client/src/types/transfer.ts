export interface SelectedFile extends File {
  id: string;
  optimizedChunkSize: number;
  parallelStreams: number;
}

export interface TransferMetrics {
  startTime: number;
  bytesTransferred: number;
  speed: string;
  eta: string;
}

export interface ConnectionInfo {
  effectiveType?: string;
  downlink?: number;
  status: 'connected' | 'disconnected' | 'reconnecting';
}
