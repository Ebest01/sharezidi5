import { useState, useRef, useCallback } from 'react';
import { TransferUtils } from '../lib/transferUtils';
import type { SelectedFile, TransferMetrics } from '../types/transfer';
import type { Device, TransferProgress, FileInfo } from '@shared/types';

export const useFileTransfer = (websocket: any) => {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [transfers, setTransfers] = useState<Map<string, TransferProgress>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transferMetricsRef = useRef<Map<string, TransferMetrics>>(new Map());

  const addFiles = useCallback((fileList: FileList) => {
    const newFiles: SelectedFile[] = Array.from(fileList).map(file => {
      const fileSize = file.size || 0;
      const fileName = file.name || 'Unknown File';
      const fileType = file.type || 'application/octet-stream';
      
      // Create a new SelectedFile that extends the original File object
      const selectedFile = Object.assign(file, {
        id: TransferUtils.generateFileId(),
        optimizedChunkSize: TransferUtils.getOptimalChunkSize(fileSize),
        parallelStreams: TransferUtils.getParallelChunkCount()
      }) as SelectedFile;
      
      return selectedFile;
    });
    
    setSelectedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      addFiles(files);
    }
  }, [addFiles]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    
    const files = event.dataTransfer.files;
    if (files) {
      addFiles(files);
    }
  }, [addFiles]);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const startTransfer = useCallback(async (device: Device, files: SelectedFile[]) => {
    if (!websocket.isConnected) {
      throw new Error('Not connected to server');
    }

    for (const file of files) {
      const fileInfo: FileInfo = {
        name: file.name,
        size: file.size,
        type: file.type,
        totalChunks: Math.ceil(file.size / file.optimizedChunkSize),
        chunkSize: file.optimizedChunkSize
      };

      // Initialize transfer progress
      const transferProgress: TransferProgress = {
        deviceId: device.id,
        fileInfo,
        sentProgress: 0,
        receivedProgress: 0,
        status: 'pending',
        duplicateChunks: 0,
        missingChunks: [],
        isTransferring: true
      };

      setTransfers(prev => new Map(prev.set(`${device.id}-${file.id}`, transferProgress)));

      // Start transfer
      websocket.send('transfer-request', {
        toUserId: device.id,
        fileInfo,
        fileId: file.id
      });

      // Send file chunks
      await sendFileChunks(file, device.id, fileInfo);
    }
  }, [websocket]);

  const sendFileChunks = async (file: SelectedFile, deviceId: string, fileInfo: FileInfo) => {
    const chunks = Math.ceil(file.size / file.optimizedChunkSize);
    let sentChunks = 0;
    let acknowledgedChunks = 0;
    const pendingChunks = new Set<number>();
    const maxConcurrentChunks = Math.min(file.parallelStreams, 4); // Limit concurrency

    // Initialize metrics
    const metrics: TransferMetrics = {
      startTime: Date.now(),
      bytesTransferred: 0,
      speed: '0 MB/s',
      eta: 'Calculating...'
    };
    transferMetricsRef.current.set(`${deviceId}-${file.id}`, metrics);

    // Set up chunk acknowledgment handler
    const handleChunkAck = (data: any) => {
      if (data.fileId === file.id && data.status === 'received') {
        acknowledgedChunks++;
        pendingChunks.delete(data.chunkIndex);
        
        // Update receiver progress based on acknowledged chunks
        const receiverProgress = (acknowledgedChunks / chunks) * 100;
        setTransfers(prev => {
          const key = `${deviceId}-${file.id}`;
          const transfer = prev.get(key);
          if (transfer) {
            const updated = { 
              ...transfer, 
              receivedProgress: receiverProgress,
              status: receiverProgress === 100 ? 'completed' : 'active'
            };
            return new Map(prev.set(key, updated));
          }
          return prev;
        });
      }
    };

    websocket.on('chunk-ack', handleChunkAck);

    // Send chunks with flow control
    for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
      // Wait if too many chunks are pending
      while (pendingChunks.size >= maxConcurrentChunks) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const start = chunkIndex * file.optimizedChunkSize;
      const end = Math.min(start + file.optimizedChunkSize, file.size);
      
      // Ensure file has slice method (it should since it extends File)
      if (typeof file.slice !== 'function') {
        console.error('File object missing slice method:', file);
        throw new Error('Invalid file object - missing slice method');
      }
      
      const chunk = file.slice(start, end);
      
      const arrayBuffer = await chunk.arrayBuffer();
      
      // Send chunk
      const success = websocket.send('file-chunk', {
        toUserId: deviceId,
        fileId: file.id,
        chunkIndex,
        chunk: arrayBuffer,
        totalChunks: chunks
      });

      if (success) {
        sentChunks++;
        pendingChunks.add(chunkIndex);
        const senderProgress = (sentChunks / chunks) * 100;
        
        // Update sender progress only
        setTransfers(prev => {
          const key = `${deviceId}-${file.id}`;
          const transfer = prev.get(key);
          if (transfer) {
            const updated = { ...transfer, sentProgress: senderProgress };
            return new Map(prev.set(key, updated));
          }
          return prev;
        });

        // Update metrics
        metrics.bytesTransferred += chunk.size;
        const elapsed = (Date.now() - metrics.startTime) / 1000;
        const speedBps = metrics.bytesTransferred / elapsed;
        metrics.speed = TransferUtils.formatFileSize(speedBps) + '/s';
        
        const remainingBytes = file.size - metrics.bytesTransferred;
        const etaSeconds = remainingBytes / speedBps;
        metrics.eta = etaSeconds > 0 ? `${Math.ceil(etaSeconds)}s` : 'Complete';

        // Adaptive delay based on connection speed and pending chunks
        const delay = Math.max(1, Math.min(50, pendingChunks.size * 2));
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('Failed to send chunk, connection lost');
        break;
      }
    }

    // Wait for all chunks to be acknowledged
    while (acknowledgedChunks < chunks && pendingChunks.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Clean up
    websocket.off('chunk-ack', handleChunkAck);

    // Mark transfer as completed
    setTransfers(prev => {
      const key = `${deviceId}-${file.id}`;
      const transfer = prev.get(key);
      if (transfer) {
        const updated = { 
          ...transfer, 
          status: 'completed' as const,
          isTransferring: false
        };
        return new Map(prev.set(key, updated));
      }
      return prev;
    });

    // Notify completion
    websocket.send('transfer-complete', {
      toUserId: deviceId,
      fileId: file.id,
      fileName: file.name
    });
  };

  const getTotalSize = useCallback(() => {
    return selectedFiles.reduce((total, file) => total + file.size, 0);
  }, [selectedFiles]);

  const getTotalSizeMB = useCallback(() => {
    return TransferUtils.formatFileSize(getTotalSize());
  }, [getTotalSize]);

  // Listen for transfer events
  websocket.on('transfer-accepted', (data: { fromUserId: string; fileId: string }) => {
    console.log('Transfer accepted:', data);
  });

  websocket.on('transfer-rejected', (data: { fromUserId: string; reason: string }) => {
    console.error('Transfer rejected:', data.reason);
  });

  return {
    selectedFiles,
    transfers,
    isDragging,
    fileInputRef,
    addFiles,
    removeFile,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    openFileDialog,
    startTransfer,
    getTotalSize,
    getTotalSizeMB
  };
};
