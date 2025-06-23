import React, { useState, useRef, useCallback } from 'react';
import { TransferUtils } from '../lib/transferUtils';
import type { SelectedFile, TransferMetrics } from '../types/transfer';
import type { Device, TransferProgress, FileInfo } from '@shared/types';

export const useFileTransfer = (websocket: any) => {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [transfers, setTransfers] = useState<Map<string, TransferProgress>>(new Map());
  const [incomingTransfers, setIncomingTransfers] = useState<Map<string, TransferProgress>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transferMetricsRef = useRef<Map<string, TransferMetrics>>(new Map());
  const receivedChunks = useRef<Map<string, Map<number, ArrayBuffer>>>(new Map());

  const totalSizeMB = selectedFiles.reduce((total, file) => total + file.size, 0) / (1024 * 1024);

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
    if (files.length > 0) {
      addFiles(files);
    }
  }, [addFiles]);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const sendFileChunks = async (file: SelectedFile, deviceId: string, fileInfo: FileInfo) => {
    const chunks = Math.ceil(file.size / file.optimizedChunkSize);
    const maxConcurrentChunks = file.parallelStreams;
    const pendingChunks = new Set<number>();
    let acknowledgedChunks = 0;

    const metrics: TransferMetrics = {
      startTime: Date.now(),
      bytesTransferred: 0,
      speed: '0 B/s',
      eta: 'Calculating...'
    };

    transferMetricsRef.current.set(file.id, metrics);

    for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
      // Rate limiting for concurrent chunks
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
        pendingChunks.add(chunkIndex);
        
        // Update transfer progress
        const senderProgress = ((chunkIndex + 1) / chunks) * 100;
        const key = `${websocket.userId}-${deviceId}-${file.id}`;
        
        setTransfers(prev => {
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

    // Set up chunk acknowledgment handler for this transfer
    const handleChunkAck = (data: any) => {
      if (data.fileId === file.id && data.status === 'received') {
        acknowledgedChunks++;
        pendingChunks.delete(data.chunkIndex);
        console.log(`[FileTransfer] Chunk ${data.chunkIndex} acknowledged, total: ${acknowledgedChunks}/${chunks}`);
      }
    };

    websocket.on('chunk-ack', handleChunkAck);

    // Wait for all chunks to be acknowledged
    while (acknowledgedChunks < chunks && pendingChunks.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Clean up the handler
    websocket.off('chunk-ack');

    // Mark transfer as complete
    websocket.send('transfer-complete', {
      toUserId: deviceId,
      fileId: file.id
    });
  };

  const startTransfer = useCallback(async (device: Device, files: SelectedFile[]) => {
    for (const file of files) {
      const fileInfo: FileInfo = {
        name: file.name,
        size: file.size,
        type: file.type,
        totalChunks: Math.ceil(file.size / file.optimizedChunkSize),
        chunkSize: file.optimizedChunkSize
      };

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

      const transferId = `${websocket.userId}-${device.id}-${file.id}`;
      setTransfers(prev => new Map(prev.set(transferId, transferProgress)));

      // Send transfer request
      const success = websocket.send('transfer-request', {
        toUserId: device.id,
        fileInfo,
        fileId: file.id
      });

      if (success) {
        // Start sending file chunks
        await sendFileChunks(file, device.id, fileInfo);
      }
    }
  }, [websocket]);

  // Set up WebSocket handlers for incoming transfers
  React.useEffect(() => {
    if (!websocket?.on) return;

    const handleTransferRequest = (data: any) => {
      console.log('[FileTransfer] Incoming transfer request:', data);
      
      // Create transfer progress entry for incoming file
      const transferId = `${data.from}-${websocket.userId}-${data.fileId}`;
      const transferProgress: TransferProgress = {
        deviceId: data.from,
        fileInfo: data.fileInfo,
        sentProgress: 0,
        receivedProgress: 0,
        status: 'pending',
        duplicateChunks: 0,
        missingChunks: [],
        isTransferring: true
      };

      setIncomingTransfers(prev => new Map(prev.set(transferId, transferProgress)));
      
      // Auto-accept transfer
      websocket.send('transfer-response', {
        toUserId: data.from,
        accepted: true,
        fileId: data.fileId
      });
    };

    const handleFileChunk = (data: any) => {
      const transferId = `${data.from}-${websocket.userId}-${data.fileId}`;
      const receivedProgress = ((data.chunkIndex + 1) / data.totalChunks) * 100;
      
      setIncomingTransfers(prev => {
        const newMap = new Map(prev);
        const transfer = newMap.get(transferId);
        if (transfer) {
          transfer.receivedProgress = receivedProgress;
          transfer.status = receivedProgress >= 100 ? 'completed' : 'active';
          newMap.set(transferId, transfer);
        }
        return newMap;
      });
    };

    const handleSyncStatus = (data: any) => {
      const transferId = `${data.senderId}-${data.receiverId}-${data.fileId}`;
      
      // Update incoming transfer if we're the receiver
      if (data.receiverId === websocket.userId) {
        setIncomingTransfers(prev => {
          const newMap = new Map(prev);
          const transfer = newMap.get(transferId);
          if (transfer) {
            transfer.sentProgress = data.senderProgress;
            transfer.receivedProgress = data.receiverProgress;
            newMap.set(transferId, transfer);
          }
          return newMap;
        });
      }
      
      // Update outgoing transfer if we're the sender
      if (data.senderId === websocket.userId) {
        setTransfers(prev => {
          const newMap = new Map(prev);
          const transfer = newMap.get(transferId);
          if (transfer) {
            transfer.sentProgress = data.senderProgress;
            transfer.receivedProgress = data.receiverProgress;
            newMap.set(transferId, transfer);
          }
          return newMap;
        });
      }
    };

    const handleTransferComplete = (data: any) => {
      const transferId = `${data.from}-${websocket.userId}-${data.fileId}`;
      
      setIncomingTransfers(prev => {
        const newMap = new Map(prev);
        const transfer = newMap.get(transferId);
        if (transfer) {
          transfer.status = 'completed';
          transfer.isTransferring = false;
          transfer.receivedProgress = 100;
          newMap.set(transferId, transfer);
        }
        return newMap;
      });
    };

    websocket.on('transfer-request', handleTransferRequest);
    websocket.on('file-chunk', handleFileChunk);
    websocket.on('sync-status', handleSyncStatus);
    websocket.on('transfer-complete', handleTransferComplete);

    return () => {
      websocket.off('transfer-request');
      websocket.off('file-chunk');
      websocket.off('sync-status');
      websocket.off('transfer-complete');
    };
  }, [websocket]);

  return {
    selectedFiles,
    transfers,
    incomingTransfers,
    isDragging,
    totalSizeMB,
    fileInputRef,
    addFiles,
    startTransfer,
    removeFile,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    openFileDialog
  };
};