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

  // Helper function to convert ArrayBuffer to Base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Helper function to convert Base64 to ArrayBuffer
  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

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
    const acknowledgedChunks = new Set<number>();
    let sentChunks = 0;

    const metrics: TransferMetrics = {
      startTime: Date.now(),
      bytesTransferred: 0,
      speed: '0 B/s',
      eta: 'Calculating...'
    };

    transferMetricsRef.current.set(file.id, metrics);

    // Set up chunk acknowledgment handler for this transfer
    const handleChunkAck = (data: any) => {
      if (data.fileId === file.id && data.status === 'received') {
        acknowledgedChunks.add(data.chunkIndex);
        console.log(`[FileTransfer] Chunk ${data.chunkIndex} acknowledged, total: ${acknowledgedChunks.size}/${chunks}`);
      }
    };

    websocket.on('chunk-ack', handleChunkAck);

    try {
      // Send all chunks sequentially with acknowledgment waiting
      for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
        const start = chunkIndex * file.optimizedChunkSize;
        const end = Math.min(start + file.optimizedChunkSize, file.size);
        
        // Ensure file has slice method (it should since it extends File)
        if (typeof file.slice !== 'function') {
          console.error('File object missing slice method:', file);
          throw new Error('Invalid file object - missing slice method');
        }
        
        const chunk = file.slice(start, end);
        const arrayBuffer = await chunk.arrayBuffer();
        
        // Convert ArrayBuffer to Base64 for JSON transmission
        const base64Chunk = arrayBufferToBase64(arrayBuffer);
        
        // Send chunk
        const success = websocket.send('file-chunk', {
          toUserId: deviceId,
          fileId: file.id,
          chunkIndex,
          chunk: base64Chunk,
          totalChunks: chunks
        });

        if (success) {
          sentChunks++;
          
          // Update transfer progress
          const senderProgress = (sentChunks / chunks) * 100;
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
          metrics.bytesTransferred += arrayBuffer.byteLength;
          const elapsed = (Date.now() - metrics.startTime) / 1000;
          const speedBps = metrics.bytesTransferred / elapsed;
          metrics.speed = TransferUtils.formatFileSize(speedBps) + '/s';
          
          const remainingBytes = file.size - metrics.bytesTransferred;
          const etaSeconds = remainingBytes / speedBps;
          metrics.eta = etaSeconds > 0 ? `${Math.ceil(etaSeconds)}s` : 'Complete';

          // Wait for acknowledgment with timeout
          const startTime = Date.now();
          while (!acknowledgedChunks.has(chunkIndex) && Date.now() - startTime < 5000) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          if (!acknowledgedChunks.has(chunkIndex)) {
            console.warn(`[FileTransfer] Chunk ${chunkIndex} not acknowledged, continuing anyway`);
          }

          // Small delay between chunks
          await new Promise(resolve => setTimeout(resolve, 5));
        } else {
          console.error('Failed to send chunk, connection lost');
          break;
        }
      }

      // Mark transfer as complete
      websocket.send('transfer-complete', {
        toUserId: deviceId,
        fileId: file.id
      });
    } finally {
      // Clean up the handler
      websocket.off('chunk-ack');
    }
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
      
      console.log(`[FileTransfer] Received chunk ${data.chunkIndex}, size:`, data.chunk?.length || 'unknown', 'type:', typeof data.chunk);
      
      // Store the chunk data for file reconstruction
      if (!receivedChunks.current.has(data.fileId)) {
        receivedChunks.current.set(data.fileId, new Map());
      }
      
      // Convert Base64 back to ArrayBuffer
      const chunkData = typeof data.chunk === 'string' ? base64ToArrayBuffer(data.chunk) : data.chunk;
      receivedChunks.current.get(data.fileId)!.set(data.chunkIndex, chunkData);
      
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

      // Send chunk acknowledgment
      websocket.send('chunk-ack', {
        toUserId: data.from,
        chunkIndex: data.chunkIndex,
        fileId: data.fileId,
        status: 'received',
        receiverProgress: receivedProgress
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
          
          // Reconstruct and download the file
          reconstructAndDownloadFile(data.fileId, transfer.fileInfo);
        }
        return newMap;
      });
    };

    const reconstructAndDownloadFile = (fileId: string, fileInfo: any) => {
      const chunks = receivedChunks.current.get(fileId);
      if (!chunks) {
        console.error('[FileTransfer] No chunks found for file:', fileId);
        return;
      }

      console.log(`[FileTransfer] Reconstructing file: ${fileInfo.name} (${chunks.size} chunks)`);
      
      // Debug: Check chunk data
      chunks.forEach((chunk, index) => {
        console.log(`[FileTransfer] Chunk ${index}:`, chunk, 'Type:', typeof chunk, 'Size:', chunk?.byteLength || 'unknown');
      });
      
      // Sort chunks by index and combine them
      const sortedChunks = Array.from(chunks.entries())
        .sort(([a], [b]) => a - b)
        .map(([, chunk]) => {
          // Ensure chunk is ArrayBuffer
          if (chunk instanceof ArrayBuffer) {
            return chunk;
          } else if (typeof chunk === 'string') {
            // Convert Base64 string to ArrayBuffer
            return base64ToArrayBuffer(chunk);
          } else if (chunk && typeof chunk === 'object' && chunk.data) {
            // Handle case where chunk is wrapped in an object
            return chunk.data;
          } else {
            console.error('[FileTransfer] Invalid chunk data:', chunk);
            return new ArrayBuffer(0);
          }
        });

      // Create blob from all chunks
      const blob = new Blob(sortedChunks, { type: fileInfo.type || 'application/octet-stream' });
      
      console.log(`[FileTransfer] Created blob size: ${blob.size} bytes, expected: ${fileInfo.size} bytes`);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileInfo.name;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      receivedChunks.current.delete(fileId);
      
      console.log(`[FileTransfer] File downloaded: ${fileInfo.name}`);
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