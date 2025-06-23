import { WebSocket } from 'ws';
import type { Device, TransferProgress, ChunkData, TransferRequest, SyncStatus } from '@shared/types';

interface ConnectedUser {
  id: string;
  socket: WebSocket;
  lastPing: number;
  deviceName?: string;
}

export class FileTransferService {
  private connectedUsers = new Map<string, ConnectedUser>();
  private activeTransfers = new Map<string, TransferProgress>();
  private chunkBuffers = new Map<string, Map<number, ArrayBuffer>>();
  private syncStatuses = new Map<string, SyncStatus>();

  constructor() {
    // Clean up stale connections every 2 minutes (increased from 30 seconds)
    setInterval(() => this.cleanupStaleConnections(), 120000);
  }

  registerUser(userId: string, socket: WebSocket, deviceName?: string) {
    console.log(`[FileTransfer] User ${userId} (${deviceName || 'Unknown Device'}) connected`);
    
    this.connectedUsers.set(userId, {
      id: userId,
      socket,
      lastPing: Date.now(),
      deviceName
    });

    // Send initial device list to the new user
    this.sendToUser(userId, 'devices', Array.from(this.connectedUsers.keys()));
    
    // Broadcast updated device list to all users
    this.broadcastUserList();
    this.setupSocketHandlers(userId, socket);
  }

  unregisterUser(userId: string) {
    console.log(`[FileTransfer] User ${userId} disconnected`);
    
    this.connectedUsers.delete(userId);
    this.broadcastUserList();
    
    // Cancel any active transfers for this user
    this.cancelUserTransfers(userId);
  }

  private setupSocketHandlers(userId: string, socket: WebSocket) {
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(userId, message);
      } catch (error) {
        console.error(`[FileTransfer] Failed to parse message from ${userId}:`, error);
      }
    });

    socket.on('close', () => {
      this.unregisterUser(userId);
    });

    socket.on('error', (error) => {
      console.error(`[FileTransfer] Socket error for ${userId}:`, error);
    });
  }

  public handleMessage(userId: string, message: any) {
    const user = this.connectedUsers.get(userId);
    if (!user) return;

    user.lastPing = Date.now();

    switch (message.type) {
      case 'register':
        // Re-register with device name if provided
        if (message.data?.deviceName) {
          user.deviceName = message.data.deviceName;
          console.log(`[FileTransfer] User ${userId} updated device name to ${message.data.deviceName}`);
          this.broadcastUserList();
        }
        break;
      case 'ping':
        this.sendToUser(userId, 'pong', { timestamp: Date.now() });
        break;
      case 'transfer-request':
        this.handleTransferRequest(userId, message.data);
        break;
      case 'transfer-response':
        this.handleTransferResponse(userId, message.data);
        break;
      case 'file-chunk':
        this.handleFileChunk(userId, message.data);
        break;
      case 'chunk-ack':
        this.handleChunkAck(userId, message.data);
        break;
      case 'transfer-complete':
        this.handleTransferComplete(userId, message.data);
        break;
      case 'resume-transfer':
        this.handleResumeTransfer(userId, message.data);
        break;
      case 'sync-status':
        this.handleSyncStatus(userId, message.data);
        break;
      case 'cancel-transfer':
        this.handleCancelTransfer(userId, message.data);
        break;
      default:
        console.log(`[FileTransfer] Unknown message type: ${message.type}`);
    }
  }

  private getDeviceDisplayName(deviceName?: string, userId?: string): string {
    if (!deviceName) return `Device ${userId?.substring(0, 6) || 'Unknown'}`;
    
    // Count devices of same type to add numbers
    const sameTypeDevices = Array.from(this.connectedUsers.values())
      .filter(user => user.deviceName?.includes(deviceName.split(' ')[0]))
      .length;
    
    if (deviceName.includes('Windows PC')) {
      return sameTypeDevices > 1 ? `PC${sameTypeDevices}` : 'PC1';
    }
    if (deviceName.includes('Mac')) {
      return sameTypeDevices > 1 ? `Mac${sameTypeDevices}` : 'Mac1';
    }
    if (deviceName.includes('iPhone')) {
      return sameTypeDevices > 1 ? `iPhone${sameTypeDevices}` : 'iPhone';
    }
    if (deviceName.includes('iPad')) {
      return sameTypeDevices > 1 ? `iPad${sameTypeDevices}` : 'iPad';
    }
    if (deviceName.includes('Android')) {
      return sameTypeDevices > 1 ? `Android${sameTypeDevices}` : 'Android';
    }
    if (deviceName.includes('Linux PC')) {
      return sameTypeDevices > 1 ? `Linux${sameTypeDevices}` : 'Linux1';
    }
    
    return deviceName;
  }

  private handleTransferRequest(fromUserId: string, data: any) {
    const { toUserId, fileInfo, fileId } = data;
    const toUser = this.connectedUsers.get(toUserId);
    
    if (!toUser) {
      this.sendToUser(fromUserId, 'transfer-error', {
        error: 'Target user not found',
        fileId
      });
      return;
    }

    // Initialize transfer tracking
    const transferId = `${fromUserId}-${toUserId}-${fileId}`;
    const transfer: TransferProgress = {
      deviceId: toUserId,
      fileInfo,
      sentProgress: 0,
      receivedProgress: 0,
      status: 'pending',
      duplicateChunks: 0,
      missingChunks: [],
      isTransferring: false
    };

    this.activeTransfers.set(transferId, transfer);
    this.chunkBuffers.set(transferId, new Map());

    // Initialize sync status
    const syncStatus: SyncStatus = {
      senderId: fromUserId,
      receiverId: toUserId,
      fileId,
      senderProgress: 0,
      receiverProgress: 0,
      syncLag: 0,
      duplicatesRejected: 0,
      lastChunkTime: Date.now()
    };
    this.syncStatuses.set(transferId, syncStatus);

    // Forward request to receiver
    this.sendToUser(toUserId, 'transfer-request', {
      from: fromUserId,
      fileInfo,
      fileId
    });
  }

  private handleTransferResponse(fromUserId: string, data: any) {
    const { toUserId, accepted, fileId, reason } = data;
    
    if (accepted) {
      const transferId = `${toUserId}-${fromUserId}-${fileId}`;
      const transfer = this.activeTransfers.get(transferId);
      
      if (transfer) {
        transfer.status = 'active';
        transfer.isTransferring = true;
        this.activeTransfers.set(transferId, transfer);
      }

      this.sendToUser(toUserId, 'transfer-accepted', { fromUserId, fileId });
    } else {
      this.sendToUser(toUserId, 'transfer-rejected', { fromUserId, reason, fileId });
      
      // Clean up
      const transferId = `${toUserId}-${fromUserId}-${fileId}`;
      this.activeTransfers.delete(transferId);
      this.chunkBuffers.delete(transferId);
      this.syncStatuses.delete(transferId);
    }
  }

  private handleFileChunk(fromUserId: string, data: any) {
    const { toUserId, fileId, chunkIndex, chunk, totalChunks } = data;
    const transferId = `${fromUserId}-${toUserId}-${fileId}`;
    
    const transfer = this.activeTransfers.get(transferId);
    const syncStatus = this.syncStatuses.get(transferId);
    
    if (!transfer || !syncStatus) {
      console.error(`[FileTransfer] No active transfer found: ${transferId}`);
      return;
    }

    // Initialize chunk buffer if not exists
    if (!this.chunkBuffers.has(transferId)) {
      this.chunkBuffers.set(transferId, new Map());
    }
    const chunkBuffer = this.chunkBuffers.get(transferId)!;

    // Check for duplicate chunks
    if (chunkBuffer.has(chunkIndex)) {
      console.log(`[FileTransfer] Duplicate chunk ${chunkIndex} rejected for ${transferId}`);
      syncStatus.duplicatesRejected++;
      transfer.duplicateChunks++;
      
      // Send duplicate acknowledgment
      this.sendToUser(fromUserId, 'chunk-ack', {
        chunkIndex,
        fileId,
        status: 'duplicate'
      });
      return;
    }

    // Store chunk and update progress
    chunkBuffer.set(chunkIndex, chunk);
    syncStatus.lastChunkTime = Date.now();
    
    // Calculate actual progress based on received chunks
    const receivedChunks = chunkBuffer.size;
    const receiverProgress = (receivedChunks / totalChunks) * 100;
    
    // Update sender progress based on chunk index
    const senderProgress = Math.min(((chunkIndex + 1) / totalChunks) * 100, 100);
    
    syncStatus.senderProgress = senderProgress;
    syncStatus.receiverProgress = receiverProgress;
    syncStatus.syncLag = Math.max(0, senderProgress - receiverProgress);
    
    transfer.sentProgress = senderProgress;
    transfer.receivedProgress = receiverProgress;
    
    this.activeTransfers.set(transferId, transfer);
    this.syncStatuses.set(transferId, syncStatus);

    // Forward chunk to receiver with proper progress tracking
    const toUser = this.connectedUsers.get(toUserId);
    if (toUser && toUser.socket.readyState === WebSocket.OPEN) {
      this.sendToUser(toUserId, 'file-chunk', {
        from: fromUserId,
        chunkIndex,
        chunk,
        totalChunks,
        fileId,
        progress: receiverProgress // Send receiver progress, not sender
      });

      // Send acknowledgment back to sender with receiver status
      this.sendToUser(fromUserId, 'chunk-ack', {
        chunkIndex,
        fileId,
        status: 'received',
        receiverProgress: receiverProgress
      });

      // Update sync status
      this.broadcastSyncStatus(transferId);
    } else {
      console.error(`[FileTransfer] Target user ${toUserId} not available`);
      this.sendToUser(fromUserId, 'transfer-error', {
        error: 'Target user disconnected',
        fileId
      });
    }
  }

  private handleChunkAck(fromUserId: string, data: any) {
    const { toUserId, chunkIndex, fileId, status } = data;
    const transferId = `${toUserId}-${fromUserId}-${fileId}`;
    
    const syncStatus = this.syncStatuses.get(transferId);
    if (syncStatus) {
      if (status === 'received') {
        // Update receiver progress
        const transfer = this.activeTransfers.get(transferId);
        if (transfer) {
          const receiverProgress = ((chunkIndex + 1) / transfer.fileInfo.totalChunks) * 100;
          syncStatus.receiverProgress = receiverProgress;
          transfer.receivedProgress = receiverProgress;
          
          // Calculate sync lag
          syncStatus.syncLag = Math.max(0, syncStatus.senderProgress - syncStatus.receiverProgress);
          
          this.activeTransfers.set(transferId, transfer);
          this.syncStatuses.set(transferId, syncStatus);
          
          // Broadcast updated sync status
          this.broadcastSyncStatus(transferId);
        }
      } else if (status === 'duplicate') {
        // Handle duplicate chunk
        syncStatus.duplicatesRejected++;
        const transfer = this.activeTransfers.get(transferId);
        if (transfer) {
          transfer.duplicateChunks++;
          this.activeTransfers.set(transferId, transfer);
        }
      }
    }

    // Forward acknowledgment to original sender
    this.sendToUser(toUserId, 'chunk-ack', data);
  }

  private handleTransferComplete(fromUserId: string, data: any) {
    const { toUserId, fileId } = data;
    const transferId = `${fromUserId}-${toUserId}-${fileId}`;
    
    const transfer = this.activeTransfers.get(transferId);
    if (transfer) {
      transfer.status = 'completed';
      transfer.isTransferring = false;
      this.activeTransfers.set(transferId, transfer);
    }

    // Notify receiver
    this.sendToUser(toUserId, 'transfer-complete', {
      from: fromUserId,
      fileId,
      fileName: transfer?.fileInfo.name
    });

    // Clean up after a delay to allow final sync
    setTimeout(() => {
      this.activeTransfers.delete(transferId);
      this.chunkBuffers.delete(transferId);
      this.syncStatuses.delete(transferId);
    }, 30000);
  }

  private handleResumeTransfer(fromUserId: string, data: any) {
    const { toUserId, fromChunk, fileId } = data;
    const transferId = `${toUserId}-${fromUserId}-${fileId}`;
    
    // Forward resume request to sender
    this.sendToUser(toUserId, 'resume-transfer', {
      from: fromUserId,
      fromChunk,
      fileId
    });
  }

  private handleSyncStatus(fromUserId: string, data: any) {
    // Handle sync status updates
    console.log(`[FileTransfer] Sync status from ${fromUserId}:`, data);
  }

  private handleCancelTransfer(fromUserId: string, data: any) {
    const { transferId, reason } = data;
    
    this.activeTransfers.delete(transferId);
    this.chunkBuffers.delete(transferId);
    this.syncStatuses.delete(transferId);
    
    console.log(`[FileTransfer] Transfer cancelled: ${transferId}, reason: ${reason}`);
  }

  private broadcastSyncStatus(transferId: string) {
    const syncStatus = this.syncStatuses.get(transferId);
    if (!syncStatus) return;

    // Send sync status to both sender and receiver
    this.sendToUser(syncStatus.senderId, 'sync-status', syncStatus);
    this.sendToUser(syncStatus.receiverId, 'sync-status', syncStatus);
  }

  private sendToUser(userId: string, type: string, data: any) {
    const user = this.connectedUsers.get(userId);
    if (user && user.socket.readyState === WebSocket.OPEN) {
      try {
        user.socket.send(JSON.stringify({ type, data }));
        return true;
      } catch (error) {
        console.error(`[FileTransfer] Failed to send message to ${userId}:`, error);
        return false;
      }
    }
    return false;
  }

  private broadcastUserList() {
    const userList = Array.from(this.connectedUsers.keys());
    
    for (const userId of this.connectedUsers.keys()) {
      this.sendToUser(userId, 'devices', userList);
    }
  }

  private cancelUserTransfers(userId: string) {
    // Cancel all transfers involving this user
    for (const [transferId, transfer] of this.activeTransfers) {
      if (transferId.includes(userId)) {
        transfer.status = 'failed';
        transfer.error = 'User disconnected';
        transfer.isTransferring = false;
        
        this.activeTransfers.delete(transferId);
        this.chunkBuffers.delete(transferId);
        this.syncStatuses.delete(transferId);
      }
    }
  }

  private cleanupStaleConnections() {
    const now = Date.now();
    const staleThreshold = 300000; // 5 minutes (increased from 1 minute)

    for (const [userId, user] of this.connectedUsers) {
      if (now - user.lastPing > staleThreshold) {
        console.log(`[FileTransfer] Removing stale connection: ${userId}`);
        this.unregisterUser(userId);
      }
    }
  }
}
