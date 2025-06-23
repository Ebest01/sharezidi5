import { useState, useEffect, useRef, useCallback } from 'react';
import type { Device, TransferProgress, SyncStatus } from '@shared/types';

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [userId] = useState(() => Math.random().toString(36).substring(2, 8));
  const [socketId, setSocketId] = useState<string>('');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const callbacksRef = useRef<Map<string, Function>>(new Map());

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Ensure we have a valid host
    const host = window.location.host;
    if (!host || host === 'undefined' || !host.includes(':')) {
      console.error('[WebSocket] Invalid host:', host);
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${host}/ws`;
    
    console.log('[WebSocket] Attempting to connect to:', wsUrl);
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('[WebSocket] Connected');
        setIsConnected(true);
        setReconnectAttempts(0);
        setSocketId(Math.random().toString(36).substring(2, 10));
        
        // Register user immediately
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'register',
            data: { userId }
          }));
        }

        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'ping',
              data: { timestamp: Date.now() }
            }));
          }
        }, 30000); // Ping every 30 seconds
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle pong response
          if (message.type === 'pong') {
            console.log('[WebSocket] Received pong');
            return;
          }
          
          const callback = callbacksRef.current.get(message.type);
          if (callback) {
            callback(message.data);
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setIsConnected(false);
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        
        // Auto-reconnect with exponential backoff
        if (reconnectAttempts < 3) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
        } else {
          console.log('[WebSocket] Max reconnection attempts reached');
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
    }
  }, [userId, reconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const send = useCallback((type: string, data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
      return true;
    }
    return false;
  }, []);

  const on = useCallback((event: string, callback: Function) => {
    callbacksRef.current.set(event, callback);
  }, []);

  const off = useCallback((event: string) => {
    callbacksRef.current.delete(event);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

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
