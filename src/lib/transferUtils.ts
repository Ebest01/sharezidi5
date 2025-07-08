export class TransferUtils {
  static getOptimalChunkSize(fileSize: number): number {
    // Reduced chunk sizes for better synchronization
    if (fileSize < 1024 * 1024) return 8 * 1024; // 8KB for small files
    if (fileSize < 10 * 1024 * 1024) return 16 * 1024; // 16KB for medium files
    if (fileSize < 100 * 1024 * 1024) return 32 * 1024; // 32KB for large files
    return 64 * 1024; // 64KB for very large files (reduced from 128KB)
  }

  static getParallelChunkCount(): number {
    const connection = (navigator as any).connection;
    if (!connection) return 4;
    
    switch (connection.effectiveType) {
      case 'slow-2g':
      case '2g': return 2;
      case '3g': return 4;
      case '4g': return 8;
      default: return 4;
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

  static calculateSyncLag(senderProgress: number, receiverProgress: number): number {
    return Math.max(0, senderProgress - receiverProgress);
  }

  static generateFileId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}
