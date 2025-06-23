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
  const callbacksRef = useRef<Map<string, Function>>(new Map());

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('[WebSocket] Connected');
        setIsConnected(true);
        setReconnectAttempts(0);
        setSocketId(Math.random().toString(36).substring(2, 10));
        
        // Register user
        send('register', { userId });
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
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
        
        // Auto-reconnect with exponential backoff
        if (reconnectAttempts < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
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
