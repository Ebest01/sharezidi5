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
        
        // Server will send us a registered message with our userId
        
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
          
          console.log('[WebSocket] Received message:', message.type, message.data);
          
          // Handle registered message to set our user ID
          if (message.type === 'registered') {
            this.currentUserId = message.data.userId;
            console.log('[WebSocket] Registered with ID:', this.currentUserId);
            // Notify subscribers about the new user ID
            this.notifySubscribers(true);
            return;
          }
          
          const callback = this.callbacks.get(message.type);
          if (callback) {
            callback(message.data);
          } else {
            console.log('[WebSocket] No callback for message type:', message.type);
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
  const [userId, setUserId] = useState<string>('');
  const [socketId, setSocketId] = useState<string>('');
  
  const wsManager = WebSocketManager.getInstance();
  const stateCallbackRef = useRef<Function>();

  useEffect(() => {
    // Create callback for connection state updates
    stateCallbackRef.current = (connected: boolean) => {
      setIsConnected(connected);
      if (connected) {
        setSocketId(Math.random().toString(36).substring(2, 10));
        // Update userId from the WebSocket manager after connection
        const currentUserId = wsManager.getCurrentUserId();
        if (currentUserId) {
          setUserId(currentUserId);
          console.log('[WebSocket] Updated local userId to:', currentUserId);
        }
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
  }, []);

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
      console.log('[WebSocket] Received device list:', deviceList);
      const currentUserId = wsManager.getCurrentUserId();
      console.log('[WebSocket] Current user ID from manager:', currentUserId);
      console.log('[WebSocket] Local userId state:', userId);
      
      // Don't process device list until we have a valid user ID
      if (!currentUserId && !userId) {
        console.log('[WebSocket] Skipping device list - no user ID yet');
        return;
      }
      
      // Update local userId if we received it from manager but haven't updated state
      if (currentUserId && currentUserId !== userId) {
        setUserId(currentUserId);
      }
      
      const myUserId = currentUserId || userId;
      const filteredDevices = deviceList
        .filter(device => {
          const shouldExclude = device.id === myUserId;
          console.log(`[WebSocket] Device ${device.id}: exclude=${shouldExclude} (myId=${myUserId})`);
          return !shouldExclude;
        })
        .map(device => ({
          id: device.id,
          name: device.name || `Device ${device.id.substring(0, 6)}`,
          type: device.name?.includes('iPhone') ? 'mobile' as const :
                device.name?.includes('iPad') ? 'tablet' as const :
                device.name?.includes('Android') ? 'mobile' as const :
                'pc' as const,
          online: true
        }));
      
      console.log('[WebSocket] Filtered devices:', filteredDevices);
      setDevices(filteredDevices);
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