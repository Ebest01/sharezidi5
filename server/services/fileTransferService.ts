import { WebSocket } from 'ws';
import type { Device, TransferProgress, ChunkData, TransferRequest, SyncStatus } from '@shared/types';

interface ConnectedUser {
  id: string;
  socket: WebSocket;
  lastPing: number;
}

export class FileTransferService {
  private connectedUsers = new Map<string, ConnectedUser>();
  private activeTransfers = new Map<string, TransferProgress>();
  private chunkBuffers = new Map<string, Map<number, ArrayBuffer>>();
  private syncStatuses = new Map<string, SyncStatus>();

  constructor() {
    // Clean up stale connections every 30 seconds
    setInterval(() => this.cleanupStaleConnections(), 30000);
  }

  registerUser(userId: string, socket: WebSocket) {
    console.log(`[FileTransfer] User ${userId} connected`);
    
    this.connectedUsers.set(userId, {
      id: userId,
      socket,
      lastPing: Date.now()
    });

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

  private handleMessage(userId: string, message: any) {
    const user = this.connectedUsers.get(userId);
    if (!user) return;

    user.lastPing = Date.now();

    switch (message.type) {
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

    // Update sender progress
    const senderProgress = ((chunkIndex + 1) / totalChunks) * 100;
    syncStatus.senderProgress = senderProgress;
    syncStatus.lastChunkTime = Date.now();
    
    transfer.sentProgress = senderProgress;
    this.activeTransfers.set(transferId, transfer);
    this.syncStatuses.set(transferId, syncStatus);

    // Forward chunk to receiver
    const toUser = this.connectedUsers.get(toUserId);
    if (toUser && toUser.socket.readyState === WebSocket.OPEN) {
      this.sendToUser(toUserId, 'file-chunk', {
        from: fromUserId,
        chunkIndex,
        chunk,
        totalChunks,
        fileId,
        progress: senderProgress
      });

      // Send acknowledgment back to sender
      this.sendToUser(fromUserId, 'chunk-ack', {
        chunkIndex,
        fileId,
        status: 'forwarded'
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
    const staleThreshold = 60000; // 1 minute

    for (const [userId, user] of this.connectedUsers) {
      if (now - user.lastPing > staleThreshold) {
        console.log(`[FileTransfer] Removing stale connection: ${userId}`);
        this.unregisterUser(userId);
      }
    }
  }
}
