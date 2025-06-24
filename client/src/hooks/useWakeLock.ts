import { useRef, useCallback, useEffect } from 'react';

class FileTransferManager {
  private wakeLock: WakeLockSentinel | null = null;
  private transferActive = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private visibilityHandler: (() => void) | null = null;

  async startTransfer() {
    console.log('[FileTransferManager] Starting transfer protection');
    this.transferActive = true;
    
    // 1. Try Wake Lock API first
    await this.requestWakeLock();
    
    // 2. Register service worker for background
    await this.registerServiceWorker();
    
    // 3. Start heartbeat to prevent idle
    this.startHeartbeat();
    
    // 4. Monitor visibility changes
    this.setupVisibilityHandlers();
  }

  private async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        console.log('[FileTransferManager] Screen wake lock activated');
        
        this.wakeLock.addEventListener('release', () => {
          console.log('[FileTransferManager] Screen wake lock released');
        });
      } catch (err) {
        console.warn('[FileTransferManager] Wake lock failed, using fallbacks:', err);
      }
    } else {
      console.warn('[FileTransferManager] Wake Lock API not supported');
    }
  }

  private async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        // Register a simple service worker for background sync
        const swCode = `
          self.addEventListener('sync', event => {
            if (event.tag === 'continue-transfer') {
              console.log('Background sync: continue-transfer');
            }
          });
          
          self.addEventListener('message', event => {
            if (event.data && event.data.type === 'KEEP_ALIVE') {
              // Keep service worker active
              event.ports[0].postMessage('ALIVE');
            }
          });
        `;
        
        const blob = new Blob([swCode], { type: 'application/javascript' });
        const swUrl = URL.createObjectURL(blob);
        await navigator.serviceWorker.register(swUrl);
        console.log('[FileTransferManager] Service worker registered');
      } catch (error) {
        console.warn('[FileTransferManager] Service worker registration failed:', error);
      }
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.transferActive) {
        // Multiple strategies to prevent idle
        
        // 1. Dummy network request
        fetch(window.location.origin + '/ping', { 
          method: 'POST', 
          keepalive: true,
          body: JSON.stringify({ timestamp: Date.now() })
        }).catch(() => {}); // Ignore errors
        
        // 2. Keep service worker active
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          const channel = new MessageChannel();
          navigator.serviceWorker.controller.postMessage(
            { type: 'KEEP_ALIVE' }, 
            [channel.port2]
          );
        }
        
        // 3. Dummy DOM operation to prevent garbage collection
        const dummy = document.createElement('div');
        dummy.remove();
        
        console.log('[FileTransferManager] Heartbeat ping sent');
      }
    }, 20000); // Every 20 seconds
  }

  private setupVisibilityHandlers() {
    this.visibilityHandler = async () => {
      if (document.hidden && this.transferActive) {
        console.log('[FileTransferManager] App backgrounded during transfer');
        await this.handleBackground();
      } else if (!document.hidden && this.wakeLock === null) {
        console.log('[FileTransferManager] App foregrounded, re-acquiring wake lock');
        await this.requestWakeLock();
      }
    };
    
    document.addEventListener('visibilitychange', this.visibilityHandler);
    
    // Also handle page freeze/unfreeze
    window.addEventListener('freeze', () => {
      console.log('[FileTransferManager] Page frozen during transfer');
    });
    
    window.addEventListener('resume', () => {
      console.log('[FileTransferManager] Page resumed, re-activating protection');
      if (this.transferActive) {
        this.requestWakeLock();
      }
    });
  }

  private async handleBackground() {
    // Try to register background sync
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if ('sync' in registration) {
          await (registration as any).sync.register('continue-transfer');
          console.log('[FileTransferManager] Background sync registered');
        }
      } catch (error) {
        console.warn('[FileTransferManager] Background sync failed:', error);
      }
    }
    
    // Send immediate WebSocket ping to maintain connection
    try {
      if (window.WebSocket && window.wsConnection) {
        window.wsConnection.send(JSON.stringify({ type: 'ping' }));
      }
    } catch (error) {
      console.warn('[FileTransferManager] Background WebSocket ping failed:', error);
    }
  }

  cleanup() {
    console.log('[FileTransferManager] Cleaning up transfer protection');
    this.transferActive = false;
    
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  isActive() {
    return this.transferActive;
  }
}

export const useWakeLock = () => {
  const managerRef = useRef<FileTransferManager | null>(null);

  const requestWakeLock = useCallback(async () => {
    if (!managerRef.current) {
      managerRef.current = new FileTransferManager();
    }
    await managerRef.current.startTransfer();
    return true;
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (managerRef.current) {
      managerRef.current.cleanup();
      managerRef.current = null;
    }
  }, []);

  const isWakeLockActive = useCallback(() => {
    return managerRef.current?.isActive() ?? false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.cleanup();
      }
    };
  }, []);

  return {
    requestWakeLock,
    releaseWakeLock,
    isWakeLockActive
  };
};