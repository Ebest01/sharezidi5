import React, { useState, useRef, useCallback, useEffect } from 'react';
// Browser-compatible imports
import { WebRTCTransfer, WebRTCTransferConfig } from '../lib/webrtcTransfer';
import { QRDiscovery, DeviceInfo, QRCodeData } from '../lib/qrDiscovery';
import { ResumeTransfer, TransferState } from '../lib/resumeTransfer';
import { FileEncryption, EncryptionKey } from '../lib/encryption';
import { MobilePWA, PWAConfig, ServiceWorkerConfig } from '../lib/mobilePWA';
import type { SelectedFile, TransferMetrics } from '../types/transfer';
import type { Device, TransferProgress, FileInfo } from '@shared/types';

export interface TransferV2Config {
  webrtc: WebRTCTransferConfig;
  pwa: PWAConfig;
  sw: ServiceWorkerConfig;
}

export const useFileTransferV2 = (websocket: any, config: TransferV2Config) => {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [transfers, setTransfers] = useState<Map<string, TransferProgress>>(new Map());
  const [incomingTransfers, setIncomingTransfers] = useState<Map<string, TransferProgress>>(new Map());
  const [discoveredDevices, setDiscoveredDevices] = useState<DeviceInfo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);

  // Core services
  const webrtcTransfer = useRef<WebRTCTransfer | null>(null);
  const qrDiscovery = useRef<QRDiscovery | null>(null);
  const resumeTransfer = useRef<ResumeTransfer | null>(null);
  const fileEncryption = useRef<FileEncryption | null>(null);
  const mobilePWA = useRef<MobilePWA | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transferMetricsRef = useRef<Map<string, TransferMetrics>>(new Map());
  const receivedChunks = useRef<Map<string, Map<number, ArrayBuffer>>>(new Map());

  // Initialize services
  useEffect(() => {
    initializeServices();
    return () => cleanupServices();
  }, []);

  const initializeServices = async () => {
    try {
      // Initialize WebRTC transfer
      webrtcTransfer.current = new WebRTCTransfer(config.webrtc);
      setupWebRTCHandlers();

      // Initialize QR discovery
      qrDiscovery.current = new QRDiscovery();
      setupQRDiscoveryHandlers();

      // Initialize resume transfer
      resumeTransfer.current = new ResumeTransfer();
      setupResumeHandlers();

      // Initialize encryption
      if (encryptionEnabled) {
        fileEncryption.current = new FileEncryption();
        setupEncryptionHandlers();
      }

      // Initialize mobile PWA
      mobilePWA.current = new MobilePWA(config.pwa, config.sw);
      setupPWAHandlers();

      console.log('[FileTransferV2] All services initialized');
    } catch (error) {
      console.error('[FileTransferV2] Failed to initialize services:', error);
    }
  };

  const cleanupServices = () => {
    webrtcTransfer.current?.destroy();
    qrDiscovery.current?.destroy();
    resumeTransfer.current?.destroy();
    fileEncryption.current?.destroy();
    mobilePWA.current?.destroy();
  };

  // WebRTC handlers
  const setupWebRTCHandlers = () => {
    if (!webrtcTransfer.current) return;

    webrtcTransfer.current.on('connection-state-change', (state) => {
      setConnectionStatus(state === 'connected' ? 'connected' : 'disconnected');
    });

    webrtcTransfer.current.on('file-info', (data) => {
      handleIncomingFileInfo(data);
    });

    webrtcTransfer.current.on('file-chunk', (data) => {
      handleIncomingFileChunk(data);
    });

    webrtcTransfer.current.on('chunk-ack', (data) => {
      handleChunkAck(data);
    });

    webrtcTransfer.current.on('transfer-complete', (data) => {
      handleTransferComplete(data);
    });

    webrtcTransfer.current.on('progress', (data) => {
      updateTransferProgress(data);
    });
  };

  // QR Discovery handlers
  const setupQRDiscoveryHandlers = () => {
    if (!qrDiscovery.current) return;

    qrDiscovery.current.onDeviceFoundHandler((device) => {
      setDiscoveredDevices(prev => {
        const exists = prev.some(d => d.id === device.id);
        if (!exists) {
          return [...prev, device];
        }
        return prev;
      });
    });

    qrDiscovery.current.onTransferRequestHandler((data) => {
      handleTransferRequest(data);
    });
  };

  // Resume handlers
  const setupResumeHandlers = () => {
    if (!resumeTransfer.current) return;

    resumeTransfer.current.on('transfer-created', (state) => {
      console.log('[FileTransferV2] Transfer state created:', state);
    });

    resumeTransfer.current.on('chunk-completed', (data) => {
      console.log('[FileTransferV2] Chunk completed:', data);
    });

    resumeTransfer.current.on('transfer-completed', (data) => {
      console.log('[FileTransferV2] Transfer completed:', data);
    });
  };

  // Encryption handlers
  const setupEncryptionHandlers = () => {
    if (!fileEncryption.current) return;

    fileEncryption.current.on('key-generated', (key) => {
      console.log('[FileTransferV2] Encryption key generated:', key.keyId);
    });

    fileEncryption.current.on('key-exchange-initiated', (exchange) => {
      console.log('[FileTransferV2] Key exchange initiated');
    });
  };

  // PWA handlers
  const setupPWAHandlers = () => {
    if (!mobilePWA.current) return;

    mobilePWA.current.on('app-hidden', () => {
      console.log('[FileTransferV2] App hidden, maintaining transfers');
    });

    mobilePWA.current.on('network-offline', () => {
      console.log('[FileTransferV2] Network offline, pausing transfers');
    });

    mobilePWA.current.on('network-online', () => {
      console.log('[FileTransferV2] Network online, resuming transfers');
    });
  };

  // Enhanced file transfer with all features
  const sendFileV2 = async (file: SelectedFile, deviceId: string): Promise<void> => {
    try {
      // Request wake lock for mobile
      await mobilePWA.current?.requestWakeLock();

      // Calculate file checksum
      const checksum = fileEncryption.current 
        ? await fileEncryption.current.generateFileChecksum(file as any)
        : '';

      // Create transfer state for resume capability
      const transferState = resumeTransfer.current?.createTransferState(
        file.id,
        file.name,
        file.size,
        Math.ceil(file.size / config.webrtc.chunkSize),
        checksum,
        { type: file.type, lastModified: file.lastModified }
      );

      // Initialize WebRTC connection
      await webrtcTransfer.current?.initializeConnection();

      // Perform key exchange if encryption enabled
      if (encryptionEnabled && fileEncryption.current) {
        const publicKey = fileEncryption.current.getCurrentPublicKey();
        if (publicKey) {
          // Send public key to recipient
          websocket.send('key-exchange', {
            toUserId: deviceId,
            publicKey,
            keyId: fileEncryption.current.getCurrentKeyId()
          });
        }
      }

      // Send file with encryption
      await webrtcTransfer.current?.sendFile(file as any);

      console.log(`[FileTransferV2] File ${file.name} sent successfully`);
    } catch (error) {
      console.error('[FileTransferV2] Failed to send file:', error);
      throw error;
    }
  };

  // Handle incoming file info
  const handleIncomingFileInfo = (data: any) => {
    const transferId = `${data.from}-${websocket.userId}-${data.fileId}`;
    const transferProgress: TransferProgress = {
      deviceId: data.from,
      fileInfo: {
        id: data.fileId,
        name: data.fileName,
        size: data.fileSize,
        type: 'application/octet-stream',
        totalChunks: data.totalChunks
      },
      sentProgress: 0,
      receivedProgress: 0,
      status: 'pending',
      duplicateChunks: 0,
      missingChunks: [],
      isTransferring: true
    };

    setIncomingTransfers(prev => new Map(prev.set(transferId, transferProgress)));
  };

  // Handle incoming file chunk
  const handleIncomingFileChunk = async (data: any) => {
    const transferId = `${data.from}-${websocket.userId}-${data.fileId}`;
    
    try {
      // Decrypt chunk if encryption enabled
      let chunkData: ArrayBuffer;
      if (encryptionEnabled && fileEncryption.current) {
        const encryptedChunk = {
          data: data.chunk,
          iv: data.iv,
          tag: data.tag,
          keyId: data.keyId,
          chunkIndex: data.chunkIndex
        };
        chunkData = await fileEncryption.current.decryptChunk(encryptedChunk);
      } else {
        chunkData = base64ToArrayBuffer(data.chunk);
      }

      // Store chunk
      if (!receivedChunks.current.has(data.fileId)) {
        receivedChunks.current.set(data.fileId, new Map());
      }
      receivedChunks.current.get(data.fileId)!.set(data.chunkIndex, chunkData);

      // Update progress
      const totalChunks = data.totalChunks || 0;
      const receivedProgress = totalChunks > 0 ? ((data.chunkIndex + 1) / totalChunks) * 100 : 0;

      setIncomingTransfers(prev => {
        const newMap = new Map(prev);
        const transfer = newMap.get(transferId);
        if (transfer) {
          const updatedTransfer = {
            ...transfer,
            receivedProgress,
            status: receivedProgress >= 100 ? 'completed' as const : 'active' as const
          };
          newMap.set(transferId, updatedTransfer);
        }
        return newMap;
      });

      // Update resume state
      resumeTransfer.current?.updateChunkCompleted(data.fileId, data.chunkIndex);

      // Send ACK
      websocket.send('chunk-ack', {
        toUserId: data.from,
        fileId: data.fileId,
        chunkIndex: data.chunkIndex,
        receivedProgress
      });

    } catch (error) {
      console.error('[FileTransferV2] Failed to process chunk:', error);
      resumeTransfer.current?.updateChunkFailed(data.fileId, data.chunkIndex);
    }
  };

  // Handle chunk ACK
  const handleChunkAck = (data: any) => {
    const transferId = `${websocket.userId}-${data.from}-${data.fileId}`;
    setTransfers(prev => {
      const newMap = new Map(prev);
      const transfer = newMap.get(transferId);
      if (transfer) {
        const updatedTransfer = {
          ...transfer,
          receivedProgress: data.receivedProgress || 0
        };
        newMap.set(transferId, updatedTransfer);
      }
      return newMap;
    });
  };

  // Handle transfer complete
  const handleTransferComplete = (data: any) => {
    const transferId = `${data.from}-${websocket.userId}-${data.fileId}`;
    
    // Release wake lock
    mobilePWA.current?.releaseWakeLock();
    
    // Complete resume state
    resumeTransfer.current?.completeTransfer(data.fileId);
    
    setIncomingTransfers(prev => {
      const newMap = new Map(prev);
      const transfer = newMap.get(transferId);
      if (transfer) {
        const updatedTransfer = {
          ...transfer,
          status: 'completed' as const,
          isTransferring: false,
          receivedProgress: 100
        };
        newMap.set(transferId, updatedTransfer);
      }
      return newMap;
    });
  };

  // Update transfer progress
  const updateTransferProgress = (data: any) => {
    const transferId = `${websocket.userId}-${data.fileId}`;
    setTransfers(prev => {
      const newMap = new Map(prev);
      const transfer = newMap.get(transferId);
      if (transfer) {
        const updatedTransfer = {
          ...transfer,
          sentProgress: data.percentage,
          status: data.percentage >= 100 ? 'completed' as const : 'active' as const
        };
        newMap.set(transferId, updatedTransfer);
      }
      return newMap;
    });
  };

  // Generate QR code for device discovery
  const generateDeviceQR = async (): Promise<string> => {
    if (!qrDiscovery.current) return '';
    
    const deviceInfo: DeviceInfo = {
      id: websocket.userId,
      name: 'ShareZidi Device',
      ip: '192.168.1.50',
      port: 8080,
      capabilities: ['file-transfer', 'webrtc', 'encryption'],
      lastSeen: Date.now()
    };

    return await qrDiscovery.current.generateDeviceQR(deviceInfo);
  };

  // Generate QR code for transfer request
  const generateTransferQR = async (file: SelectedFile): Promise<string> => {
    if (!qrDiscovery.current) return '';
    
    const deviceInfo: DeviceInfo = {
      id: websocket.userId,
      name: 'ShareZidi Device',
      ip: '192.168.1.50',
      port: 8080,
      capabilities: ['file-transfer', 'webrtc', 'encryption'],
      lastSeen: Date.now()
    };

    return await qrDiscovery.current.generateTransferQR(deviceInfo, {
      name: file.name,
      size: file.size,
      type: file.type
    });
  };

  // Resume interrupted transfer
  const resumeTransferV2 = async (fileId: string): Promise<void> => {
    const resumeInfo = resumeTransfer.current?.getResumeInfo(fileId);
    if (!resumeInfo) {
      throw new Error('No resume information available');
    }

    const chunksToResume = resumeTransfer.current?.getChunksToResume(fileId) || [];
    console.log(`[FileTransferV2] Resuming transfer ${fileId} from chunks:`, chunksToResume);

    // Send resume request
    websocket.send('transfer-resume', {
      fileId,
      chunksToResume
    });
  };

  // Utility functions
  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // File management
  const addFiles = useCallback((fileList: FileList) => {
    const newFiles: SelectedFile[] = Array.from(fileList).map(file => ({
      id: Math.random().toString(36).substring(2, 15),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    }));

    setSelectedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setSelectedFiles(prev => prev.filter(file => file.id !== fileId));
  }, []);

  const startTransfer = useCallback(async (device: Device, files: SelectedFile[]) => {
    for (const file of files) {
      await sendFileV2(file, device.id);
    }
  }, []);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      addFiles(files);
    }
  }, [addFiles]);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const totalSizeMB = selectedFiles.reduce((total, file) => total + file.size, 0) / (1024 * 1024);

  return {
    // State
    selectedFiles,
    transfers,
    incomingTransfers,
    discoveredDevices,
    isDragging,
    isZipping,
    zipProgress,
    connectionStatus,
    encryptionEnabled,
    
    // Refs
    fileInputRef,
    
    // Computed
    totalSizeMB,
    
    // Actions
    addFiles,
    removeFile,
    startTransfer,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    openFileDialog,
    
    // V2 Features
    generateDeviceQR,
    generateTransferQR,
    resumeTransferV2,
    setEncryptionEnabled,
    
    // Services
    webrtcTransfer: webrtcTransfer.current,
    qrDiscovery: qrDiscovery.current,
    resumeTransfer: resumeTransfer.current,
    fileEncryption: fileEncryption.current,
    mobilePWA: mobilePWA.current
  };
};
