export class TransferUtils {
  static getOptimalChunkSize(fileSize: number): number {
    // Optimized chunk sizes for large file transfers
    if (fileSize < 1024 * 1024) return 16 * 1024; // 16KB for small files
    if (fileSize < 10 * 1024 * 1024) return 64 * 1024; // 64KB for medium files
    if (fileSize < 100 * 1024 * 1024) return 256 * 1024; // 256KB for large files
    if (fileSize < 500 * 1024 * 1024) return 512 * 1024; // 512KB for very large files
    return 1024 * 1024; // 1MB for huge files (700MB+)
  }

  static getParallelChunkCount(fileSize: number = 0): number {
    const connection = (navigator as any).connection;
    
    // For large files, reduce parallel chunks to avoid overwhelming WebSocket
    if (fileSize > 500 * 1024 * 1024) { // 500MB+
      return 2; // Conservative for very large files
    }
    if (fileSize > 100 * 1024 * 1024) { // 100MB+
      return 3; // Moderate for large files
    }
    
    if (!connection) return 4;
    
    switch (connection.effectiveType) {
      case 'slow-2g':
      case '2g': return 1; // Single stream for slow connections
      case '3g': return 2;
      case '4g': return 4;
      default: return 3;
    }
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static formatFileName(name: string, maxLength: number = 30): string {
    if (!name || typeof name !== 'string') return 'Unknown File';
    if (name.length <= maxLength) return name;
    
    const lastDotIndex = name.lastIndexOf('.');
    if (lastDotIndex === -1) {
      // No extension, just truncate
      return name.substring(0, maxLength - 3) + '...';
    }
    
    const extension = name.substring(lastDotIndex);
    const nameWithoutExt = name.substring(0, lastDotIndex);
    
    if (nameWithoutExt.length <= maxLength - extension.length - 1) {
      return name;
    }
    
    const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 4);
    return `${truncatedName}...${extension}`;
  }

  static getFileIcon(type: string): string {
    if (!type) return 'fas fa-file';
    if (type.startsWith('image/')) return 'fas fa-file-image';
    if (type.startsWith('video/')) return 'fas fa-file-video';
    if (type.startsWith('audio/')) return 'fas fa-file-audio';
    if (type.includes('pdf')) return 'fas fa-file-pdf';
    if (type.includes('word') || type.includes('doc')) return 'fas fa-file-word';
    if (type.includes('excel') || type.includes('sheet')) return 'fas fa-file-excel';
    if (type.includes('powerpoint') || type.includes('presentation')) return 'fas fa-file-powerpoint';
    if (type.includes('zip') || type.includes('rar')) return 'fas fa-file-archive';
    return 'fas fa-file';
  }

  static getFileIconColor(type: string): string {
    if (!type) return 'text-gray-600';
    if (type.startsWith('image/')) return 'text-green-600';
    if (type.startsWith('video/')) return 'text-red-600';
    if (type.startsWith('audio/')) return 'text-purple-600';
    if (type.includes('pdf')) return 'text-red-600';
    if (type.includes('word') || type.includes('doc')) return 'text-blue-600';
    if (type.includes('excel') || type.includes('sheet')) return 'text-green-600';
    if (type.includes('powerpoint') || type.includes('presentation')) return 'text-orange-600';
    if (type.includes('zip') || type.includes('rar')) return 'text-yellow-600';
    return 'text-gray-600';
  }

  static generateFileId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  static calculateTransferTimeout(fileSize: number): number {
    // Calculate timeout based on file size (minimum 5 minutes, 1 minute per 100MB)
    const baseSizeTimeout = Math.max(300000, (fileSize / (100 * 1024 * 1024)) * 60000); // 5 min base, +1 min per 100MB
    return Math.min(baseSizeTimeout, 3600000); // Cap at 60 minutes
  }

  static estimateTransferTime(fileSize: number, bytesPerSecond: number): number {
    if (bytesPerSecond === 0) return 0;
    return fileSize / bytesPerSecond;
  }

  static getRetryDelay(attempt: number): number {
    // Exponential backoff with jitter for failed chunks
    const baseDelay = Math.min(1000 * Math.pow(2, attempt), 30000); // Cap at 30 seconds
    return baseDelay + Math.random() * 1000; // Add jitter
  }

  static calculateSyncLag(senderProgress: number, receiverProgress: number): number {
    return Math.max(0, senderProgress - receiverProgress);
  }
}
