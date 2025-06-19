
// Soulo PWA Service Worker - Deployment Optimized
const CACHE_NAME = 'soulo-cache-v2.0.0';
const APP_VERSION = '2.0.0';
const STATIC_CACHE_NAME = 'soulo-static-v2.0.0';
const DYNAMIC_CACHE_NAME = 'soulo-dynamic-v2.0.0';

// Core static assets - only essential files
const STATIC_ASSETS = [
  '/',
  '/app',
  '/offline.html',
  '/manifest.json'
];

// Routes that should always fetch from network first
const NETWORK_FIRST_ROUTES = [
  '/app/',
  '/app/home',
  '/app/journal', 
  '/app/insights',
  '/app/smart-chat',
  '/app/settings'
];

function swLog(message, data = null) {
  console.log(`[SW v${APP_VERSION}] ${new Date().toISOString()}: ${message}`, data || '');
}

// Install - minimal caching
self.addEventListener('install', (event) => {
  swLog('Installing service worker');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        swLog('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        swLog('Service worker installed, skipping waiting');
        return self.skipWaiting();
      })
      .catch(error => {
        swLog('Installation failed', error);
      })
  );
});

// Activate - clean old caches aggressively
self.addEventListener('activate', (event) => {
  swLog('Activating service worker');
  
  event.waitUntil(
    Promise.all([
      // Delete ALL old caches
      caches.keys().then(cacheNames => {
        const deletePromises = cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
            swLog('Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        }).filter(Boolean);
        
        return Promise.all(deletePromises);
      }),
      self.clients.claim()
    ])
    .then(async () => {
      swLog('Service worker activated');
      
      // Notify all clients of activation
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_ACTIVATED',
          version: APP_VERSION,
          timestamp: Date.now()
        });
      });
    })
    .catch(error => {
      swLog('Activation failed', error);
    })
  );
});

// Fetch - simplified network-first strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and extensions
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;
  if (event.request.url.includes('supabase.co')) return;

  const url = new URL(event.request.url);
  const isAppRoute = NETWORK_FIRST_ROUTES.some(route => url.pathname.startsWith(route));
  
  event.respondWith(
    (async () => {
      try {
        // Always try network first for app routes and API calls
        if (isAppRoute || url.pathname.startsWith('/api/')) {
          swLog(`Network first for: ${url.pathname}`);
          
          // Network with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          const networkResponse = await fetch(event.request, {
            signal: controller.signal,
            cache: 'no-cache' // Force fresh fetch
          });
          
          clearTimeout(timeoutId);
          
          if (networkResponse && networkResponse.ok) {
            // Don't cache app routes - always fetch fresh
            if (!isAppRoute) {
              const cache = await caches.open(DYNAMIC_CACHE_NAME);
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }
        }

        // Try cache for static assets
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Final network attempt
        const networkResponse = await fetch(event.request);
        
        if (networkResponse && networkResponse.ok) {
          // Only cache successful responses for static assets
          if (!isAppRoute && !url.pathname.startsWith('/api/')) {
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            cache.put(event.request, networkResponse.clone());
          }
        }
        
        return networkResponse;
        
      } catch (error) {
        swLog(`Fetch failed for ${event.request.url}`, error.name);
        
        // Try cache as last resort
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          const offlineResponse = await caches.match('/offline.html');
          if (offlineResponse) {
            return offlineResponse;
          }
        }
        
        return new Response('Network error', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      }
    })()
  );
});

// Message handling
self.addEventListener('message', (event) => {
  swLog('Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    swLog('Skipping waiting');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    swLog('Clearing all caches');
    caches.keys().then(cacheNames => {
      return Promise.all(cacheNames.map(name => caches.delete(name)));
    }).then(() => {
      swLog('All caches cleared');
      event.ports[0]?.postMessage({ success: true });
    });
  }
});

swLog('Service worker loaded', { version: APP_VERSION });
