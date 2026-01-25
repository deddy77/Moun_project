const CACHE_NAME = 'together-pwa-v6';
const STATIC_CACHE = 'together-static-v6';
const DYNAMIC_CACHE = 'together-dynamic-v6';
const API_CACHE = 'together-api-v6';

// Core assets needed for offline functionality
const CRITICAL_ASSETS = [
  '/',
  '/offline/',
  '/static/styles/style.css',
  '/static/styles/pwa-install.css',
  '/static/js/script.js',
  '/static/js/offline-storage.js',
  '/static/js/offline-integration.js',
  '/static/js/pwa-install-prompt.js',
  '/static/manifest.json',
  '/static/images/avatar.svg',
  '/static/images/logo.png',
];

// Additional assets to cache (non-critical)
const ADDITIONAL_ASSETS = [
  '/static/images/icons/android/android-launchericon-48-48.png',
  '/static/images/icons/android/android-launchericon-72-72.png',
  '/static/images/icons/android/android-launchericon-96-96.png',
  '/static/images/icons/android/android-launchericon-144-144.png',
  '/static/images/icons/android/android-launchericon-192-192.png',
  '/static/images/icons/android/android-launchericon-512-512.png',
];

// Maximum number of items to cache per cache type
const CACHE_LIMITS = {
  [DYNAMIC_CACHE]: 50,  // HTML pages and images
  [API_CACHE]: 100,     // API responses
};

// Install event - cache resources aggressively
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing v4 - Aggressive Caching...');
  event.waitUntil(
    Promise.all([
      // Cache critical assets first
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[ServiceWorker] Caching critical assets');
        return cache.addAll(CRITICAL_ASSETS).catch(err => {
          console.error('[ServiceWorker] Critical cache failed:', err);
          // Try one by one
          return Promise.allSettled(
            CRITICAL_ASSETS.map(url => 
              cache.add(url)
                .then(() => console.log('[ServiceWorker] Cached:', url))
                .catch(e => console.warn('[ServiceWorker] Failed:', url, e.message))
            )
          );
        });
      }),
      // Cache additional assets (don't fail if these don't work)
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[ServiceWorker] Caching additional assets');
        return Promise.allSettled(
          ADDITIONAL_ASSETS.map(url => 
            cache.add(url)
              .then(() => console.log('[ServiceWorker] Cached:', url))
              .catch(e => console.warn('[ServiceWorker] Skipped:', url))
          )
        );
      })
    ])
  );
  self.skipWaiting();
});

// Activate event - clean up old caches and take control immediately
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating v4...');
  event.waitUntil(
    Promise.all([
      // Delete old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName !== API_CACHE) {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all pages immediately
      self.clients.claim()
    ])
  );
  console.log('[ServiceWorker] Now controlling all pages');
});

// Helper: Limit cache size
async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    // Delete oldest items (FIFO)
    const itemsToDelete = keys.length - maxItems;
    for (let i = 0; i < itemsToDelete; i++) {
      await cache.delete(keys[i]);
      console.log('[ServiceWorker] Deleted old cache item:', keys[i].url);
    }
  }
}

// Fetch event - Cache everything, serve cached when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip chrome extensions
  if (url.origin.includes('chrome-extension')) {
    return;
  }

  console.log('[ServiceWorker] Fetch:', request.url);

  // 1. STATIC ASSETS - Cache first (CSS, JS, fonts, icons)
  if (request.url.includes('/static/js/') || 
      request.url.includes('/static/styles/') || 
      request.url.includes('/static/images/icons/') ||
      request.url.includes('/static/manifest.json')) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
    return;
  }

  // 2. IMAGES/MEDIA - Cache first (user uploaded content)
  if (request.url.includes('/images/') || 
      request.url.includes('/media/') ||
      request.url.includes('/static/images/') && !request.url.includes('/icons/')) {
    event.respondWith(cacheFirstStrategy(request, DYNAMIC_CACHE));
    return;
  }

  // 3. API & DYNAMIC DATA - Network first with cache fallback
  if (request.url.includes('/api/') || 
      request.url.includes('/check_user_status/') ||
      request.url.includes('/get_follow_data/') ||
      request.url.includes('/inbox/') ||
      request.url.includes('/conversation/') ||
      request.url.includes('/profile/') ||
      request.url.includes('/room/')) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
    return;
  }

  // 4. HTML PAGES - Network first with cache fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
    return;
  }

  // 5. POST REQUESTS - Network only (don't cache)
  if (request.method === 'POST') {
    event.respondWith(fetch(request));
    return;
  }

  // 6. Everything else - Network first with cache fallback
  event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
});

// STRATEGY 1: Cache-first (for static assets - instant load)
async function cacheFirstStrategy(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    console.log('[ServiceWorker] ✓ Cache hit:', request.url);
    return cachedResponse;
  }

  console.log('[ServiceWorker] ✗ Cache miss, fetching:', request.url);
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      console.log('[ServiceWorker] ✓ Cached:', request.url);
      
      // Limit cache size
      if (CACHE_LIMITS[cacheName]) {
        limitCacheSize(cacheName, CACHE_LIMITS[cacheName]);
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[ServiceWorker] ✗ Fetch failed:', request.url, error.message);
    return new Response('Offline - Resource not available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({ 'Content-Type': 'text/plain' })
    });
  }
}

// Helper: Check if response indicates server is down
async function isServerError(response) {
  // Server error status codes (5xx)
  if (response.status >= 500) {
    console.log('[ServiceWorker] ⚠️ Server error:', response.status);
    return true;
  }
  
  // Gateway errors (502, 503, 504)
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    console.log('[ServiceWorker] ⚠️ Gateway error:', response.status);
    return true;
  }
  
  // CRITICAL: Check for ngrok error pages (ERR_NGROK_8012, ERR_NGROK_3200)
  // ngrok returns 200 status with HTML error page - must inspect content
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    try {
      const clone = response.clone();
      const text = await clone.text();
      const lowerText = text.toLowerCase();
      
      // Detect ngrok error patterns
      const isNgrokError = (
        // Check for ERR_NGROK codes (8012, 3200, 3208, etc.)
        text.includes('ERR_NGROK_8012') ||
        text.includes('ERR_NGROK_3200') ||
        text.includes('ERR_NGROK_3208') ||
        text.includes('ERR_NGROK') ||
        
        // Check for ngrok error messages
        (lowerText.includes('ngrok') && (
          lowerText.includes('endpoint') && lowerText.includes('offline') ||
          lowerText.includes('tunnel') && lowerText.includes('not found') ||
          lowerText.includes('failed to complete tunnel connection')
        ))
      );
      
      if (isNgrokError) {
        console.log('[ServiceWorker] ⚠️ NGROK ERROR DETECTED - Falling back to cache');
        return true;
      }
      
      // Check if response is too short to be real HTML (ngrok errors are small)
      if (text.length < 1000 && lowerText.includes('ngrok')) {
        console.log('[ServiceWorker] ⚠️ Suspected ngrok error (small HTML with ngrok)');
        return true;
      }
    } catch (e) {
      console.log('[ServiceWorker] Error reading response body:', e.message);
    }
  }
  
  return false;
}

// STRATEGY 2: Network-first (for dynamic data - always fresh when online)
// CACHE EVERYTHING visited for offline access
// Fall back to cache if server is down (even if network is up)
async function networkFirstStrategy(request, cacheName) {
  try {
    console.log('[ServiceWorker] → Network first:', request.url);
    const networkResponse = await fetch(request);
    
    // Check if server is actually working (not just network)
    const serverError = await isServerError(networkResponse);
    if (serverError) {
      console.log('[ServiceWorker] 🚨 SERVER/NGROK ERROR - Falling back to cache');
      
      // Notify all clients that server is offline
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({ type: 'SERVER_OFFLINE' });
      });
      
      // Server is down, try cache first
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        console.log('[ServiceWorker] ✓ Serving from cache (server offline mode)');
        
        // Add custom header to indicate we're in server-offline mode
        const headers = new Headers(cachedResponse.headers);
        headers.append('X-Served-From', 'cache-server-offline');
        
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers: headers
        });
      }
      
      // No cache available for HTML pages - try offline page
      if (request.headers.get('accept')?.includes('text/html')) {
        const cache = await caches.open(STATIC_CACHE);
        const offlinePage = await cache.match('/offline/');
        if (offlinePage) {
          console.log('[ServiceWorker] → Serving offline page');
          return offlinePage;
        }
      }
      
      // No cache at all - return error
      console.log('[ServiceWorker] ✗ No cache available for server error');
      return new Response(JSON.stringify({ 
        error: 'Server Offline',
        message: 'Server is temporarily unavailable. Cached content not available.',
        cached: false
      }), {
        status: 503,
        headers: new Headers({ 'Content-Type': 'application/json' })
      });
    }
    
    // Server is working fine
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      
      // Cache the response for offline use
      cache.put(request, networkResponse.clone()).then(() => {
        console.log('[ServiceWorker] ✓ Network success, cached:', request.url);
        
        // Limit cache size
        if (CACHE_LIMITS[cacheName]) {
          limitCacheSize(cacheName, CACHE_LIMITS[cacheName]);
        }
      });
    }
    
    return networkResponse;
  } catch (error) {
    // Network completely failed (offline)
    console.log('[ServiceWorker] ✗ Network failed, checking cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('[ServiceWorker] ✓ Serving from cache (offline mode)');
      return cachedResponse;
    }
    
    // No cache available - return offline page for HTML
    if (request.headers.get('accept')?.includes('text/html')) {
      const cache = await caches.open(STATIC_CACHE);
      const offlinePage = await cache.match('/offline/') || await cache.match('/');
      if (offlinePage) {
        console.log('[ServiceWorker] → Serving offline page');
        return offlinePage;
      }
    }
    
    console.log('[ServiceWorker] ✗ No cache available');
    return new Response(JSON.stringify({ 
      error: 'Offline',
      message: 'You are currently offline. Please check your connection.',
      cached: false
    }), {
      status: 503,
      headers: new Headers({ 'Content-Type': 'application/json' })
    });
  }
}

// Background sync - Queue offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncPendingActions());
  }
});

// Sync pending actions from IndexedDB
async function syncPendingActions() {
  console.log('[ServiceWorker] Syncing pending actions...');
  
  try {
    // Notify all clients to sync their pending actions
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_PENDING_ACTIONS'
      });
    });
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error);
  }
}

// Message event - communicate with pages
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data);
  
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data.action === 'getCacheStatus') {
    caches.keys().then(cacheNames => {
      event.ports[0].postMessage({
        caches: cacheNames,
        version: 'v4'
      });
    });
  }
  
  if (event.data.action === 'clearCache') {
    caches.keys().then(cacheNames => {
      return Promise.all(cacheNames.map(name => caches.delete(name)));
    }).then(() => {
      event.ports[0].postMessage({ cleared: true });
    });
  }
});

// Log service worker state
console.log('[ServiceWorker] Service Worker script loaded');
console.log('[ServiceWorker] Version: v4');
console.log('[ServiceWorker] Caches: STATIC, DYNAMIC, API');

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/static/images/icons/icon-192x192.png',
    badge: '/static/images/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Together', options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
