// ShareZidi v2.0 Service Worker
const CACHE_NAME = 'sharezidi-v2.0';
const CACHE_VERSION = '2.0.0';
const OFFLINE_PAGE = '/offline.html';

// Files to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/offline.html'
];

// Dynamic routes to cache
const DYNAMIC_ROUTES = [
  '/api/',
  '/transfer/',
  '/files/'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing ShareZidi v2.0 Service Worker');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating ShareZidi v2.0 Service Worker');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Old caches cleaned up');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle different types of requests
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isAPIRequest(request)) {
    event.respondWith(handleAPIRequest(request));
  } else if (isFileTransfer(request)) {
    event.respondWith(handleFileTransfer(request));
  } else {
    event.respondWith(handleNavigation(request));
  }
});

// Handle static assets
async function handleStaticAsset(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Failed to handle static asset:', error);
    return new Response('Asset not available offline', { status: 404 });
  }
}

// Handle API requests
async function handleAPIRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] API request failed:', error);
    
    // Try to serve from cache
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('API not available offline', { status: 503 });
  }
}

// Handle file transfer requests
async function handleFileTransfer(request) {
  try {
    // For file transfers, always try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful file transfers
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] File transfer failed:', error);
    
    // For file transfers, don't serve from cache if network fails
    return new Response('File transfer not available offline', { status: 503 });
  }
}

// Handle navigation requests
async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.error('[SW] Navigation failed, serving offline page');
    
    const cache = await caches.open(CACHE_NAME);
    const offlineResponse = await cache.match(OFFLINE_PAGE);
    
    if (offlineResponse) {
      return offlineResponse;
    }
    
    return new Response('Offline - Page not available', { status: 503 });
  }
}

// Background sync for file transfers
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'file-transfer') {
    event.waitUntil(handleBackgroundFileTransfer());
  } else if (event.tag === 'transfer-resume') {
    event.waitUntil(handleTransferResume());
  }
});

// Handle background file transfer
async function handleBackgroundFileTransfer() {
  try {
    console.log('[SW] Processing background file transfer');
    
    // Get pending transfers from IndexedDB
    const pendingTransfers = await getPendingTransfers();
    
    for (const transfer of pendingTransfers) {
      await processPendingTransfer(transfer);
    }
    
    console.log('[SW] Background file transfer completed');
  } catch (error) {
    console.error('[SW] Background file transfer failed:', error);
  }
}

// Handle transfer resume
async function handleTransferResume() {
  try {
    console.log('[SW] Processing transfer resume');
    
    // Get interrupted transfers
    const interruptedTransfers = await getInterruptedTransfers();
    
    for (const transfer of interruptedTransfers) {
      await resumeInterruptedTransfer(transfer);
    }
    
    console.log('[SW] Transfer resume completed');
  } catch (error) {
    console.error('[SW] Transfer resume failed:', error);
  }
}

// Push notifications for transfer updates
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: data.tag,
      data: data.data,
      actions: [
        {
          action: 'view',
          title: 'View Transfer',
          icon: '/icons/icon-192x192.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/icon-192x192.png'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/transfers')
    );
  }
});

// Message handling from main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'CACHE_FILE':
      handleCacheFile(data);
      break;
    case 'CLEAR_CACHE':
      handleClearCache();
      break;
    case 'GET_CACHE_SIZE':
      handleGetCacheSize(event.ports[0]);
      break;
    case 'KEEP_ALIVE':
      // Keep service worker alive
      break;
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// Helper functions
function isStaticAsset(request) {
  return request.destination === 'image' || 
         request.destination === 'script' || 
         request.destination === 'style' ||
         request.url.includes('/assets/');
}

function isAPIRequest(request) {
  return request.url.includes('/api/');
}

function isFileTransfer(request) {
  return request.url.includes('/transfer/') || 
         request.url.includes('/files/');
}

async function getPendingTransfers() {
  // This would interact with IndexedDB
  return [];
}

async function processPendingTransfer(transfer) {
  // Process pending transfer
  console.log('[SW] Processing transfer:', transfer.id);
}

async function getInterruptedTransfers() {
  // This would interact with IndexedDB
  return [];
}

async function resumeInterruptedTransfer(transfer) {
  // Resume interrupted transfer
  console.log('[SW] Resuming transfer:', transfer.id);
}

async function handleCacheFile(data) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = new Response(data.file);
    await cache.put(data.url, response);
    console.log('[SW] File cached:', data.url);
  } catch (error) {
    console.error('[SW] Failed to cache file:', error);
  }
}

async function handleClearCache() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('[SW] Cache cleared');
  } catch (error) {
    console.error('[SW] Failed to clear cache:', error);
  }
}

async function handleGetCacheSize(port) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    let totalSize = 0;
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
    
    port.postMessage({ type: 'CACHE_SIZE', size: totalSize });
  } catch (error) {
    console.error('[SW] Failed to get cache size:', error);
    port.postMessage({ type: 'CACHE_SIZE_ERROR', error: error.message });
  }
}

console.log('[SW] ShareZidi v2.0 Service Worker loaded');
