import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { FileTransferService } from "./services/fileTransferService";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize file transfer service
  const fileTransferService = new FileTransferService();

  // Create WebSocket server on /ws path to avoid conflicts with Vite HMR
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    perMessageDeflate: false
  });

  wss.on('connection', (ws: WebSocket, request) => {
    console.log('[WebSocket] New connection from:', request.socket.remoteAddress);
    
    let userId: string | null = null;
    let isRegistered = false;

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'register' && !isRegistered) {
          userId = message.data.userId;
          if (userId) {
            isRegistered = true;
            fileTransferService.registerUser(userId, ws);
            
            // Send confirmation
            ws.send(JSON.stringify({
              type: 'registered',
              data: { userId }
            }));
          }
        } else if (isRegistered && userId) {
          // Forward all messages to the file transfer service
          fileTransferService.handleMessage(userId, message);
        }
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          data: { error: 'Invalid message format' }
        }));
      }
    });

    ws.on('close', () => {
      if (userId && isRegistered) {
        fileTransferService.unregisterUser(userId);
      }
      console.log('[WebSocket] Connection closed');
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Connection error:', error);
    });

    // Send ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);

    ws.on('close', () => {
      clearInterval(pingInterval);
    });
  });

  return httpServer;
}
