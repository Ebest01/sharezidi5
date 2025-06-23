import { useState, useEffect, useRef, useCallback } from 'react';
import type { Device, TransferProgress, SyncStatus } from '@shared/types';

// Global singleton to prevent multiple connections in development mode
let globalWebSocket: WebSocket | null = null;
let globalConnectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
let globalCallbacks: Map<string, Function> = new Map();

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [userId] = useState(() => Math.random().toString(36).substring(2, 8));
  const [socketId, setSocketId] = useState<string>('');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    // Prevent multiple connections
    if (globalConnectionState === 'connected' || globalConnectionState === 'connecting') {
      setIsConnected(globalConnectionState === 'connected');
      return;
    }

    const host = window.location.host;
    if (!host || host === 'undefined') {
      console.error('[WebSocket] Invalid host:', host);
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${host}/ws`;
    
    console.log('[WebSocket] Attempting to connect to:', wsUrl);
    globalConnectionState = 'connecting';
    
    try {
      globalWebSocket = new WebSocket(wsUrl);
      
      globalWebSocket.onopen = () => {
        console.log('[WebSocket] Connected successfully');
        globalConnectionState = 'connected';
        setIsConnected(true);
        setReconnectAttempts(0);
        setSocketId(Math.random().toString(36).substring(2, 10));
        
        // Register user immediately
        if (globalWebSocket?.readyState === WebSocket.OPEN) {
          globalWebSocket.send(JSON.stringify({
            type: 'register',
            data: { userId }
          }));
        }

        // Clear any existing ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }

        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (globalWebSocket?.readyState === WebSocket.OPEN) {
            globalWebSocket.send(JSON.stringify({
              type: 'ping',
              data: { timestamp: Date.now() }
            }));
          }
        }, 30000);
      };

      globalWebSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle pong response
          if (message.type === 'pong') {
            console.log('[WebSocket] Received pong');
            return;
          }
          
          const callback = globalCallbacks.get(message.type);
          if (callback) {
            callback(message.data);
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      globalWebSocket.onclose = (event) => {
        console.log('[WebSocket] Disconnected, code:', event.code);
        globalConnectionState = 'disconnected';
        setIsConnected(false);
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        
        // Only reconnect if not intentionally closed and component is still mounted
        if (mountedRef.current && event.code !== 1000 && event.code !== 1001 && reconnectAttempts < 2) {
          const delay = Math.min(5000 * Math.pow(2, reconnectAttempts), 20000);
          console.log(`[WebSocket] Will reconnect in ${delay}ms (attempt ${reconnectAttempts + 1})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              setReconnectAttempts(prev => prev + 1);
              connect();
            }
          }, delay);
        }
      };

      globalWebSocket.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        globalConnectionState = 'disconnected';
        setIsConnected(false);
      };

    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      globalConnectionState = 'disconnected';
      setIsConnected(false);
    }
  }, [userId, reconnectAttempts]);

  const disconnect = useCallback(() => {
    mountedRef.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    if (globalWebSocket && globalWebSocket.readyState === WebSocket.OPEN) {
      globalWebSocket.close(1000, 'Component unmounting');
    }
    
    globalWebSocket = null;
    globalConnectionState = 'disconnected';
    setIsConnected(false);
  }, []);

  const send = useCallback((type: string, data: any) => {
    if (globalWebSocket?.readyState === WebSocket.OPEN) {
      globalWebSocket.send(JSON.stringify({ type, data }));
      return true;
    }
    return false;
  }, []);

  const on = useCallback((event: string, callback: Function) => {
    globalCallbacks.set(event, callback);
  }, []);

  const off = useCallback((event: string) => {
    globalCallbacks.delete(event);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    
    // Connect if not already connected
    if (globalConnectionState === 'disconnected') {
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          connect();
        }
      }, 500); // Delay to prevent rapid reconnections
      
      return () => clearTimeout(timer);
    } else if (globalConnectionState === 'connected') {
      setIsConnected(true);
    }
    
    return () => {
      // Don't disconnect on unmount in development mode to prevent connection cycling
      if (process.env.NODE_ENV === 'production') {
        disconnect();
      }
    };
  }, [connect]);

  // Handle device list updates
  useEffect(() => {
    on('devices', (deviceList: string[]) => {
      setDevices(
        deviceList
          .filter(id => id !== userId)
          .map(id => ({
            id,
            name: `Device ${id}`,
            type: 'pc' as const,
            online: true
          }))
      );
    });

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
    reconnectAttempts
  };
};