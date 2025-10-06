import React, { useState, useRef, useCallback } from 'react';
import { TransferUtils } from '../lib/transferUtils';
import { LargeFileTransfer } from '../lib/largeFileTransfer';
import { useWakeLock } from './useWakeLock';
import type { SelectedFile, TransferMetrics } from '../types/transfer';
import type { Device, TransferProgress, FileInfo } from '@shared/types';

export const useFileTransfer = (websocket: any) => {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [transfers, setTransfers] = useState<Map<string, TransferProgress>>(new Map());
  const [incomingTransfers, setIncomingTransfers] = useState<Map<string, TransferProgress>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transferMetricsRef = useRef<Map<string, TransferMetrics>>(new Map());
  const receivedChunks = useRef<Map<string, Map<number, ArrayBuffer>>>(new Map());
  const { requestWakeLock, releaseWakeLock, isWakeLockActive } = useWakeLock();

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
        parallelStreams: TransferUtils.getParallelChunkCount(fileSize)
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
    console.log(`[FileTransfer] Starting optimized transfer for ${file.name} (${TransferUtils.formatFileSize(file.size)})`);
    
    // Get optimized settings for large files
    const settings = LargeFileTransfer.getOptimizedSettings(file.size);
    const totalChunks = Math.ceil(file.size / settings.chunkSize);
    
    // Create progress tracker
    const tracker = LargeFileTransfer.createProgressTracker(file.size, totalChunks);
    
    // Set up connection monitoring
    const { startHeartbeat, stopHeartbeat } = LargeFileTransfer.createConnectionMonitor(
      websocket,
      () => {
        console.error('[FileTransfer] Connection lost during transfer');
        // Could implement resume logic here
      }
    );

    const metrics: TransferMetrics = {
      startTime: Date.now(),
      bytesTransferred: 0,
      speed: '0 B/s',
      eta: 'Calculating...'
    };

    transferMetricsRef.current.set(file.id, metrics);
    startHeartbeat();

    try {
      console.log(`[FileTransfer] Sending ${totalChunks} chunks (${TransferUtils.formatFileSize(settings.chunkSize)} each)`);
      
      // Send chunks sequentially for large files to avoid overwhelming WebSocket
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * settings.chunkSize;
        const end = Math.min(start + settings.chunkSize, file.size);
        
        // Ensure file has slice method
        if (typeof file.slice !== 'function') {
          console.error('File object missing slice method:', file);
          throw new Error('Invalid file object - missing slice method');
        }
        
        const chunk = file.slice(start, end);
        const arrayBuffer = await chunk.arrayBuffer();

        // Send chunk with retry logic
        const success = await LargeFileTransfer.sendChunkWithRetry(
          websocket,
          arrayBuffer,
          chunkIndex,
          file.id,
          deviceId,
          totalChunks
        );

        if (!success) {
          console.error(`[FileTransfer] Failed to send chunk ${chunkIndex} after retries`);
          break;
        }

        // Update progress
        const progress = tracker.updateProgress(chunkIndex, arrayBuffer.byteLength);
        const stats = LargeFileTransfer.formatTransferStats(tracker);
        
        // Update UI - throttle updates (every 10 chunks or on last chunk)
        const shouldUpdate = chunkIndex % 10 === 0 || chunkIndex === totalChunks - 1;
        if (shouldUpdate) {
          console.log(`[FileTransfer] Progress: ${stats.percentage}% (${stats.speed}, ETA: ${stats.eta})`);
          
          const transferId = `${websocket.userId}-${deviceId}-${file.id}`;
          console.log(`[FileTransfer] Updating sender progress for ${transferId}: ${stats.percentage}%`);
          setTransfers(prev => {
            const newMap = new Map(prev);
            const transfer = newMap.get(transferId);
            if (transfer) {
              console.log(`[FileTransfer] Found transfer, updating sentProgress from ${transfer.sentProgress} to ${stats.percentage}`);
              // Create a new object to trigger React re-render
              const updatedTransfer = {
                ...transfer,
                sentProgress: parseFloat(stats.percentage),
                status: parseFloat(stats.percentage) >= 100 ? 'completed' as const : 'active' as const
              };
              newMap.set(transferId, updatedTransfer);
            } else {
              console.warn(`[FileTransfer] Transfer not found for ID: ${transferId}`);
            }
            return newMap;
          });
        }

        // Update metrics
        metrics.bytesTransferred += arrayBuffer.byteLength;
        metrics.speed = stats.speed;
        metrics.eta = stats.eta;

        // Check for stalled transfer
        if (tracker.checkStalled()) {
          console.warn('[FileTransfer] Transfer appears stalled, but continuing...');
        }

        // Brief pause between chunks for very large files to prevent overwhelming
        if (file.size > 500 * 1024 * 1024) {
          await new Promise(resolve => setTimeout(resolve, 50)); // 50ms pause
        }
      }

      // Mark transfer as complete on sender side - keep it visible
      const transferId = `${websocket.userId}-${deviceId}-${file.id}`;
      setTransfers(prev => {
        const newMap = new Map(prev);
        const transfer = newMap.get(transferId);
        if (transfer) {
          const updatedTransfer = {
            ...transfer,
            sentProgress: 100,
            status: 'completed' as const,
            isTransferring: true // Keep it visible until receiver confirms
          };
          newMap.set(transferId, updatedTransfer);
        }
        return newMap;
      });
      
      websocket.send('transfer-complete', {
        toUserId: deviceId,
        fileId: file.id
      });
      
      console.log(`[FileTransfer] Completed sending ${file.name}, waiting for receiver confirmation`);
    } finally {
      stopHeartbeat();
    }
  };

  const startTransfer = useCallback(async (device: Device, files: SelectedFile[]) => {
    // Activate comprehensive mobile transfer protection
    await requestWakeLock();
    
    for (const file of files) {
      // Use optimized settings for large files
      const settings = LargeFileTransfer.getOptimizedSettings(file.size);
      
      const fileInfo: FileInfo = {
        name: file.name,
        size: file.size,
        type: file.type,
        totalChunks: Math.ceil(file.size / settings.chunkSize),
        chunkSize: settings.chunkSize
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
      const totalChunks = data.totalChunks || 0;
      const receivedProgress = totalChunks > 0 ? ((data.chunkIndex + 1) / totalChunks) * 100 : 0;
      
      console.log(`[FileTransfer] Received chunk ${data.chunkIndex}/${totalChunks}, progress: ${receivedProgress.toFixed(1)}%`);
      
      // Store the chunk data for file reconstruction
      if (!receivedChunks.current.has(data.fileId)) {
        receivedChunks.current.set(data.fileId, new Map());
      }
      
      // Convert Base64 back to ArrayBuffer
      try {
        const chunkData = typeof data.chunk === 'string' ? base64ToArrayBuffer(data.chunk) : data.chunk;
        receivedChunks.current.get(data.fileId)!.set(data.chunkIndex, chunkData);
        
        // Update transfer progress immediately
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

        // Don't send acknowledgment - server handles this automatically
        console.log(`[FileTransfer] Chunk ${data.chunkIndex} processed successfully`);
      } catch (error) {
        console.error(`[FileTransfer] Failed to process chunk ${data.chunkIndex}:`, error);
      }
    };

    const handleSyncStatus = (data: any) => {
      const transferId = `${data.senderId}-${data.receiverId}-${data.fileId}`;
      console.log(`[FileTransfer] Sync status received for ${transferId}: sender=${data.senderProgress}%, receiver=${data.receiverProgress}%`);
      
      // Update incoming transfer if we're the receiver
      if (data.receiverId === websocket.userId) {
        setIncomingTransfers(prev => {
          const newMap = new Map(prev);
          const transfer = newMap.get(transferId);
          if (transfer) {
            const updatedTransfer = {
              ...transfer,
              sentProgress: data.senderProgress,
              receivedProgress: data.receiverProgress
            };
            newMap.set(transferId, updatedTransfer);
          }
          return newMap;
        });
      }
      
      // Update outgoing transfer if we're the sender
      if (data.senderId === websocket.userId) {
        console.log(`[FileTransfer] Updating sender's view with sync status`);
        setTransfers(prev => {
          const newMap = new Map(prev);
          const transfer = newMap.get(transferId);
          if (transfer) {
            const updatedTransfer = {
              ...transfer,
              sentProgress: data.senderProgress,
              receivedProgress: data.receiverProgress
            };
            newMap.set(transferId, updatedTransfer);
            console.log(`[FileTransfer] Sender progress updated to ${data.senderProgress}%`);
          }
          return newMap;
        });
      }
    };

    const handleTransferComplete = (data: any) => {
      const transferId = `${data.from}-${websocket.userId}-${data.fileId}`;
      
      // Release comprehensive transfer protection
      releaseWakeLock();
      
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
          } else if (chunk && typeof chunk === 'object' && 'data' in chunk) {
            // Handle case where chunk is wrapped in an object
            return (chunk as any).data;
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
    isZipping: isZipping || false,
    zipProgress: zipProgress || 0,
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