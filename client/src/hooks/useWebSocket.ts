import { useState, useEffect, useRef, useCallback } from 'react';
import type { Device, TransferProgress, SyncStatus } from '@shared/types';

// Global WebSocket manager to prevent connection storms in React dev mode
class WebSocketManager {
  private static instance: WebSocketManager;
  private ws: WebSocket | null = null;
  private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private callbacks: Map<string, Function> = new Map();
  private subscribers: Set<Function> = new Set();
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private currentUserId: string | null = null;

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  subscribe(callback: Function) {
    this.subscribers.add(callback);
    // Immediately notify current state
    callback(this.connectionState === 'connected');
  }

  unsubscribe(callback: Function) {
    this.subscribers.delete(callback);
  }

  private notifySubscribers(connected: boolean) {
    this.subscribers.forEach(callback => callback(connected));
  }

  connect() {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return;
    }

    const host = window.location.host;
    if (!host || host === 'undefined') {
      console.error('[WebSocket] Invalid host:', host);
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${host}/ws`;
    
    console.log('[WebSocket] Connecting to:', wsUrl);
    this.connectionState = 'connecting';
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('[WebSocket] Connected successfully');
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.notifySubscribers(true);
        
        // Register user - use the provided user ID, not a new one
        this.currentUserId = this.currentUserId || this.generateUserId();
        this.send('register', { 
          userId: this.currentUserId,
          deviceName: this.getDeviceName()
        });
        
        // Start heartbeat
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'pong') {
            console.log('[WebSocket] Received pong');
            return;
          }
          
          const callback = this.callbacks.get(message.type);
          if (callback) {
            callback(message.data);
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[WebSocket] Disconnected, code:', event.code);
        this.connectionState = 'disconnected';
        this.notifySubscribers(false);
        this.stopPing();
        
        // Only auto-reconnect for unexpected closures
        if (event.code !== 1000 && event.code !== 1001 && this.reconnectAttempts < 3) {
          const delay = Math.min(3000 * Math.pow(2, this.reconnectAttempts), 15000);
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
          }, delay);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.connectionState = 'disconnected';
        this.notifySubscribers(false);
      };

    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      this.connectionState = 'disconnected';
      this.notifySubscribers(false);
    }
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', data: { timestamp: Date.now() } }));
      }
    }, 30000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private generateUserId(): string {
    return Math.random().toString(36).substring(2, 8);
  }

  private getDeviceName(): string {
    const platform = navigator.platform;
    const userAgent = navigator.userAgent;
    
    if (platform.includes('Win')) return 'Windows PC';
    if (platform.includes('Mac')) return 'Mac';
    if (/iPad/.test(userAgent)) return 'iPad';
    if (/iPhone/.test(userAgent)) return 'iPhone';
    if (/Android/.test(userAgent)) return 'Android Device';
    if (platform.includes('Linux')) return 'Linux PC';
    
    return 'Unknown Device';
  }

  send(type: string, data: any): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
      return true;
    }
    return false;
  }

  on(event: string, callback: Function) {
    this.callbacks.set(event, callback);
  }

  off(event: string) {
    this.callbacks.delete(event);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.stopPing();
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'Intentional disconnect');
    }
    
    this.ws = null;
    this.connectionState = 'disconnected';
    this.notifySubscribers(false);
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  setUserId(userId: string): void {
    this.currentUserId = userId;
  }
}

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [userId] = useState(() => Math.random().toString(36).substring(2, 8));
  const [socketId, setSocketId] = useState<string>('');
  
  const wsManager = WebSocketManager.getInstance();
  const stateCallbackRef = useRef<Function>();

  useEffect(() => {
    // Set the user ID in the manager to ensure consistency
    wsManager.setUserId(userId);
    
    // Create callback for connection state updates
    stateCallbackRef.current = (connected: boolean) => {
      setIsConnected(connected);
      if (connected) {
        setSocketId(Math.random().toString(36).substring(2, 10));
      }
    };

    wsManager.subscribe(stateCallbackRef.current);
    
    // Connect if not already connected
    if (!wsManager.isConnected()) {
      wsManager.connect();
    }

    return () => {
      if (stateCallbackRef.current) {
        wsManager.unsubscribe(stateCallbackRef.current);
      }
    };
  }, [userId]);

  const send = useCallback((type: string, data: any) => {
    return wsManager.send(type, data);
  }, []);

  const on = useCallback((event: string, callback: Function) => {
    wsManager.on(event, callback);
  }, []);

  const off = useCallback((event: string) => {
    wsManager.off(event);
  }, []);

  // Handle device list updates
  useEffect(() => {
    const handleDevices = (deviceList: Array<{id: string, name: string}>) => {
      setDevices(
        deviceList
          .filter(device => device.id !== userId)
          .map(device => ({
            id: device.id,
            name: device.name || `Device ${device.id.substring(0, 6)}`,
            type: device.name?.includes('iPhone') ? 'mobile' as const :
                  device.name?.includes('iPad') ? 'tablet' as const :
                  device.name?.includes('Android') ? 'mobile' as const :
                  'pc' as const,
            online: true
          }))
      );
    };

    on('devices', handleDevices);

    return () => {
      off('devices');
    };
  }, [on, off, userId]);

  return {
    isConnected,
    devices,
    userId,
    socketId,
    send,
    on,
    off,
    reconnectAttempts: wsManager.getReconnectAttempts()
  };
};