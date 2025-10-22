import { EventEmitter } from 'events';

export interface PWAConfig {
  appName: string;
  appShortName: string;
  appDescription: string;
  themeColor: string;
  backgroundColor: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui';
  orientation: 'portrait' | 'landscape' | 'any';
  startUrl: string;
  scope: string;
}

export interface ServiceWorkerConfig {
  cacheName: string;
  cacheVersion: string;
  offlinePage: string;
  staticAssets: string[];
  dynamicRoutes: string[];
}

export class MobilePWA extends EventEmitter {
  private config: PWAConfig;
  private swConfig: ServiceWorkerConfig;
  private isInstalled = false;
  private isOnline = true;
  private wakeLock: WakeLockSentinel | null = null;
  private backgroundSyncRegistered = false;

  constructor(config: PWAConfig, swConfig: ServiceWorkerConfig) {
    super();
    this.config = config;
    this.swConfig = swConfig;
    this.initializePWA();
  }

  // Initialize PWA features
  private async initializePWA(): Promise<void> {
    await this.registerServiceWorker();
    this.setupEventListeners();
    this.setupManifest();
    this.setupInstallPrompt();
    this.setupNetworkStatus();
    this.setupBackgroundSync();
  }

  // Register service worker
  private async registerServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: this.config.scope
        });

        console.log('[PWA] Service Worker registered:', registration);

        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.emit('sw-update-available');
              }
            });
          }
        });

        this.emit('sw-registered', registration);
      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error);
        this.emit('sw-error', error);
      }
    }
  }

  // Setup event listeners
  private setupEventListeners(): void {
    // Handle app installation
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.emit('install-prompt', e);
    });

    // Handle app installed
    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.emit('app-installed');
    });

    // Handle visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.emit('app-hidden');
      } else {
        this.emit('app-visible');
      }
    });

    // Handle page freeze/unfreeze
    window.addEventListener('freeze', () => {
      this.emit('app-frozen');
    });

    window.addEventListener('resume', () => {
      this.emit('app-resumed');
    });
  }

  // Setup web app manifest
  private setupManifest(): void {
    const manifest = {
      name: this.config.appName,
      short_name: this.config.appShortName,
      description: this.config.appDescription,
      start_url: this.config.startUrl,
      scope: this.config.scope,
      display: this.config.display,
      orientation: this.config.orientation,
      theme_color: this.config.themeColor,
      background_color: this.config.backgroundColor,
      icons: [
        {
          src: '/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: '/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ],
      categories: ['productivity', 'utilities'],
      screenshots: [
        {
          src: '/screenshots/desktop.png',
          sizes: '1280x720',
          type: 'image/png',
          form_factor: 'wide'
        },
        {
          src: '/screenshots/mobile.png',
          sizes: '390x844',
          type: 'image/png',
          form_factor: 'narrow'
        }
      ]
    };

    // Create and inject manifest
    const manifestElement = document.createElement('link');
    manifestElement.rel = 'manifest';
    manifestElement.href = URL.createObjectURL(
      new Blob([JSON.stringify(manifest)], { type: 'application/json' })
    );
    document.head.appendChild(manifestElement);
  }

  // Setup install prompt
  private setupInstallPrompt(): void {
    let deferredPrompt: any;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      this.emit('install-available');
    });

    // Provide method to show install prompt
    this.showInstallPrompt = () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult: any) => {
          if (choiceResult.outcome === 'accepted') {
            this.emit('install-accepted');
          } else {
            this.emit('install-dismissed');
          }
          deferredPrompt = null;
        });
      }
    };
  }

  // Setup network status monitoring
  private setupNetworkStatus(): void {
    this.isOnline = navigator.onLine;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.emit('network-online');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.emit('network-offline');
    });
  }

  // Setup background sync
  private setupBackgroundSync(): void {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      this.backgroundSyncRegistered = true;
      this.emit('background-sync-available');
    }
  }

  // Request wake lock for file transfers
  async requestWakeLock(): Promise<boolean> {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.emit('wake-lock-released');
        });
        this.emit('wake-lock-acquired');
        return true;
      } catch (error) {
        console.error('[PWA] Wake lock request failed:', error);
        this.emit('wake-lock-error', error);
        return false;
      }
    }
    return false;
  }

  // Release wake lock
  async releaseWakeLock(): Promise<void> {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
    }
  }

  // Register background sync
  async registerBackgroundSync(tag: string, data?: any): Promise<void> {
    if (!this.backgroundSyncRegistered) {
      throw new Error('Background sync not supported');
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register(tag);
      this.emit('background-sync-registered', { tag, data });
    } catch (error) {
      console.error('[PWA] Background sync registration failed:', error);
      this.emit('background-sync-error', error);
    }
  }

  // Show install prompt
  showInstallPrompt: () => void = () => {};

  // Check if app is installed
  isAppInstalled(): boolean {
    return this.isInstalled || window.matchMedia('(display-mode: standalone)').matches;
  }

  // Check if app is online
  isAppOnline(): boolean {
    return this.isOnline;
  }

  // Get device capabilities
  getDeviceCapabilities(): {
    hasWakeLock: boolean;
    hasBackgroundSync: boolean;
    hasServiceWorker: boolean;
    hasPushNotifications: boolean;
    hasGeolocation: boolean;
    hasCamera: boolean;
  } {
    return {
      hasWakeLock: 'wakeLock' in navigator,
      hasBackgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
      hasServiceWorker: 'serviceWorker' in navigator,
      hasPushNotifications: 'PushManager' in window,
      hasGeolocation: 'geolocation' in navigator,
      hasCamera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices
    };
  }

  // Get network information
  getNetworkInfo(): {
    effectiveType: string;
    downlink: number;
    rtt: number;
    saveData: boolean;
  } | null {
    const connection = (navigator as any).connection;
    if (connection) {
      return {
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0,
        saveData: connection.saveData || false
      };
    }
    return null;
  }

  // Cache file for offline access
  async cacheFile(url: string, file: File): Promise<void> {
    if ('caches' in window) {
      const cache = await caches.open(this.swConfig.cacheName);
      const response = new Response(file);
      await cache.put(url, response);
      this.emit('file-cached', { url, file });
    }
  }

  // Get cached file
  async getCachedFile(url: string): Promise<File | null> {
    if ('caches' in window) {
      const cache = await caches.open(this.swConfig.cacheName);
      const response = await cache.match(url);
      if (response) {
        const blob = await response.blob();
        return new File([blob], 'cached-file');
      }
    }
    return null;
  }

  // Clear cache
  async clearCache(): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      this.emit('cache-cleared');
    }
  }

  // Get cache size
  async getCacheSize(): Promise<number> {
    if ('caches' in window) {
      const cache = await caches.open(this.swConfig.cacheName);
      const keys = await cache.keys();
      let totalSize = 0;
      
      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
      
      return totalSize;
    }
    return 0;
  }

  // Show notification
  async showNotification(title: string, options?: NotificationOptions): Promise<void> {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, options);
      this.emit('notification-shown', notification);
    }
  }

  // Request notification permission
  async requestNotificationPermission(): Promise<boolean> {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  // Cleanup
  destroy(): void {
    this.releaseWakeLock();
    this.removeAllListeners();
  }
}
