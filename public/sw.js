
// Soulo PWA Service Worker - Comprehensive Update Fix
const CACHE_NAME = 'soulo-cache-v1.2.1'; // Incremented version
const OFFLINE_URL = '/offline.html';
const APP_VERSION = '1.2.1'; // Incremented version
const UPDATE_CHECK_INTERVAL = 30000; // 30 seconds

// Assets to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/app',
  '/app/home',
  '/app/journal',
  '/app/insights',
  '/app/smart-chat',
  '/app/settings',
  '/offline.html',
  '/manifest.json',
  '/lovable-uploads/31ed88ef-f596-4b91-ba58-a4175eebe779.png',
  '/lovable-uploads/3f275134-f471-4af9-a7cd-700ccd855fe3.png'
];

// Cache-busting headers for critical routes
const CACHE_BUSTING_ROUTES = ['/app', '/app/', '/app/home', '/app/journal', '/app/insights', '/app/smart-chat', '/app/settings'];

// Enhanced logging
function swLog(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[SW ${APP_VERSION}] ${timestamp}: ${message}`, data || '');
}

// Force immediate activation and client claiming
self.addEventListener('install', (event) => {
  swLog('Installing new service worker - forcing immediate activation');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(CACHE_NAME).then((cache) => {
        swLog('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Force immediate activation
      self.skipWaiting()
    ]).then(() => {
      swLog('Service worker installed and activated immediately');
    }).catch((error) => {
      swLog('Installation failed', error);
      throw error;
    })
  );
});

// Enhanced activate with aggressive cleanup
self.addEventListener('activate', (event) => {
  swLog('Activating new service worker with aggressive cleanup');
  
  event.waitUntil(
    Promise.all([
      // Clear ALL old caches
      caches.keys().then((cacheNames) => {
        const deletePromises = cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            swLog('Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        }).filter(Boolean);
        
        return Promise.all(deletePromises);
      }),
      // Claim all clients immediately
      self.clients.claim()
    ]).then(async () => {
      swLog('Service worker activated with full cache cleanup');
      
      // Notify all clients immediately
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      swLog(`Notifying ${clients.length} clients of update`);
      
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_ACTIVATED',
          version: APP_VERSION,
          cacheVersion: CACHE_NAME,
          message: 'App updated successfully! Please refresh.',
          timestamp: Date.now(),
          forceRefresh: true
        });
      });
      
      // Force page reload for app routes
      clients.forEach(client => {
        const url = new URL(client.url);
        if (url.pathname.startsWith('/app')) {
          swLog('Forcing refresh for app route:', url.pathname);
          client.postMessage({
            type: 'FORCE_REFRESH',
            reason: 'Service worker updated'
          });
        }
      });
    }).catch(error => {
      swLog('Activation failed', error);
    })
  );
});

// Enhanced fetch with cache-busting for app routes
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip Chrome extension requests
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Don't interfere with Supabase API calls
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  const url = new URL(event.request.url);
  const isAppRoute = url.pathname.startsWith('/app');
  const isCacheBustingRoute = CACHE_BUSTING_ROUTES.includes(url.pathname);

  event.respondWith(
    (async () => {
      // For app routes and cache-busting routes, always try network first
      if (isAppRoute || isCacheBustingRoute) {
        try {
          swLog(`Network-first strategy for: ${url.pathname}`);
          
          // Add cache-busting headers
          const networkRequest = new Request(event.request.url, {
            headers: {
              ...event.request.headers,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });
          
          const networkResponse = await fetch(networkRequest);
          
          if (networkResponse && networkResponse.status === 200) {
            // Update cache with fresh content
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }
        } catch (error) {
          swLog(`Network failed for ${url.pathname}, falling back to cache`, error);
        }
      }

      // Try cache first for other routes
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        // For app routes, check if cache is stale
        if (isAppRoute) {
          // Serve cached content but update in background
          fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, networkResponse);
              });
            }
          }).catch(() => {
            // Ignore background update failures
          });
        }
        return cachedResponse;
      }

      // Network fallback
      try {
        const networkResponse = await fetch(event.request);
        
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }
        
        return networkResponse;
      } catch (error) {
        swLog(`Complete fetch failure for ${event.request.url}`, error);
        
        // Return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          const offlineResponse = await caches.match(OFFLINE_URL);
          if (offlineResponse) {
            return offlineResponse;
          }
        }
        
        return new Response('Offline - Content not available', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    })()
  );
});

// Enhanced message handling with force refresh capability
self.addEventListener('message', (event) => {
  swLog('Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    swLog('Skipping waiting due to client request');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: APP_VERSION,
      cacheVersion: CACHE_NAME,
      timestamp: Date.now()
    });
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    swLog('Manual update check requested');
    self.registration.update().then(() => {
      swLog('Manual update check completed');
    }).catch(error => {
      swLog('Manual update check failed', error);
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    swLog('Cache clear requested');
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      swLog('Cache cleared successfully');
      event.ports[0].postMessage({ success: true });
    }).catch(error => {
      swLog('Cache clear failed', error);
      event.ports[0].postMessage({ success: false, error: error.message });
    });
  }
});

// Aggressive update checking
let updateCheckInterval;

function startAggressiveUpdateChecking() {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
  }
  
  swLog('Starting aggressive update checking');
  
  updateCheckInterval = setInterval(async () => {
    try {
      swLog('Performing scheduled update check');
      
      const registration = await self.registration.update();
      
      if (registration.installing || registration.waiting) {
        swLog('New service worker version detected during scheduled check');
        
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'UPDATE_AVAILABLE',
            version: APP_VERSION,
            message: 'A new version is available - refresh to update'
          });
        });
      }
    } catch (error) {
      swLog('Scheduled update check failed', error);
    }
  }, UPDATE_CHECK_INTERVAL);
}

// Start aggressive checking after activation
self.addEventListener('activate', () => {
  setTimeout(startAggressiveUpdateChecking, 5000);
});

// PWABuilder compatibility - enhanced background sync
self.addEventListener('sync', (event) => {
  swLog('Background sync event', event.tag);
  
  if (event.tag === 'app-update-check') {
    event.waitUntil(
      self.registration.update().then(() => {
        swLog('Background update check completed');
      }).catch(error => {
        swLog('Background update check failed', error);
      })
    );
  }
});

swLog('Enhanced service worker script loaded', { 
  version: APP_VERSION, 
  cache: CACHE_NAME,
  updateInterval: UPDATE_CHECK_INTERVAL 
});
