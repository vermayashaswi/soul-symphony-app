
// Soulo PWA Service Worker - PWABuilder Optimized
const CACHE_NAME = 'soulo-cache-v1.3.0';
const OFFLINE_URL = '/offline.html';
const APP_VERSION = '1.3.0';
const UPDATE_CHECK_INTERVAL = 30000; // 30 seconds for PWABuilder

// Core assets for PWABuilder compatibility
const STATIC_ASSETS = [
  '/',
  '/app',
  '/app/',
  '/app/home',
  '/app/journal',
  '/app/insights',
  '/app/smart-chat',
  '/app/settings',
  '/offline.html',
  '/manifest.json',
  '/lovable-uploads/a07b91eb-274a-47b6-8180-fb4c9c0bc8a5.png'
];

// PWABuilder-friendly routes (less aggressive caching)
const PWA_BUILDER_ROUTES = [
  '/app', '/app/', '/app/home', '/app/journal', 
  '/app/insights', '/app/smart-chat', '/app/settings'
];

function swLog(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[SW PWABuilder ${APP_VERSION}] ${timestamp}: ${message}`, data || '');
}

function isPWABuilder() {
  try {
    const userAgent = self.navigator?.userAgent || '';
    const isPWABuilderUA = userAgent.includes('PWABuilder') || 
                          userAgent.includes('TWA') || 
                          userAgent.includes('WebAPK');
    
    const standaloneQuery = self.matchMedia && self.matchMedia('(display-mode: standalone)').matches;
    const fullscreenQuery = self.matchMedia && self.matchMedia('(display-mode: fullscreen)').matches;
    
    return isPWABuilderUA || standaloneQuery || fullscreenQuery;
  } catch {
    return false;
  }
}

// Install event - PWABuilder optimized
self.addEventListener('install', (event) => {
  swLog('Installing service worker for PWABuilder compatibility');
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        swLog('Caching core assets for PWABuilder');
        return cache.addAll(STATIC_ASSETS);
      }),
      self.skipWaiting()
    ]).then(() => {
      swLog('Service worker installed successfully');
    }).catch((error) => {
      swLog('Installation failed', error);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  swLog('Activating service worker');
  
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        const deletePromises = cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            swLog('Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        }).filter(Boolean);
        
        return Promise.all(deletePromises);
      }),
      self.clients.claim()
    ]).then(async () => {
      swLog('Service worker activated');
      
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      const isPWABuilderEnv = isPWABuilder();
      
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_ACTIVATED',
          version: APP_VERSION,
          cacheVersion: CACHE_NAME,
          message: 'PWA updated and ready!',
          timestamp: Date.now(),
          pwaBuilder: isPWABuilderEnv
        });
      });
    }).catch(error => {
      swLog('Activation failed', error);
    })
  );
});

// Fetch event - PWABuilder friendly caching strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;
  if (event.request.url.includes('supabase.co')) return;

  const url = new URL(event.request.url);
  const isAppRoute = url.pathname.startsWith('/app');
  const isPWABuilderRoute = PWA_BUILDER_ROUTES.includes(url.pathname);
  const isPWABuilderEnv = isPWABuilder();

  event.respondWith(
    (async () => {
      // For PWABuilder apps and app routes, use network-first with reasonable timeouts
      if (isAppRoute || isPWABuilderRoute || isPWABuilderEnv) {
        try {
          swLog(`Network-first strategy for: ${url.pathname}`);
          
          // Create request without aggressive cache control
          const networkRequest = new Request(event.request.url, {
            headers: {
              ...Object.fromEntries(event.request.headers.entries())
            }
          });
          
          // Set reasonable timeout for network requests
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
          
          const networkResponse = await fetch(networkRequest, {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }
        } catch (error) {
          swLog(`Network failed for ${url.pathname}`, error.name);
        }
      }

      // Cache fallback
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        // Update cache in background for app routes
        if (isAppRoute || isPWABuilderEnv) {
          fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, networkResponse);
              });
            }
          }).catch(() => {});
        }
        return cachedResponse;
      }

      // Final network attempt
      try {
        const networkResponse = await fetch(event.request);
        
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }
        
        return networkResponse;
      } catch (error) {
        swLog(`Complete fetch failure for ${event.request.url}`, error);
        
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

// Message handling
self.addEventListener('message', (event) => {
  swLog('Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    swLog('Skipping waiting');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: APP_VERSION,
      cacheVersion: CACHE_NAME,
      timestamp: Date.now(),
      pwaBuilderSupport: true
    });
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    swLog('Manual update check');
    self.registration.update().then(() => {
      swLog('Update check completed');
    }).catch(error => {
      swLog('Update check failed', error);
    });
  }
});

// Periodic update checking
let updateCheckInterval;

function startUpdateChecking() {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
  }
  
  swLog('Starting update checking');
  
  updateCheckInterval = setInterval(async () => {
    try {
      const registration = await self.registration.update();
      
      if (registration.installing || registration.waiting) {
        swLog('New version detected');
        
        const clients = await self.clients.matchAll();
        const isPWABuilderEnv = isPWABuilder();
        
        clients.forEach(client => {
          client.postMessage({
            type: 'UPDATE_AVAILABLE',
            version: APP_VERSION,
            message: 'New version available',
            pwaBuilder: isPWABuilderEnv
          });
        });
      }
    } catch (error) {
      swLog('Update check failed', error);
    }
  }, UPDATE_CHECK_INTERVAL);
}

self.addEventListener('activate', () => {
  setTimeout(startUpdateChecking, 2000);
});

swLog('PWABuilder-optimized service worker loaded', { 
  version: APP_VERSION, 
  cache: CACHE_NAME,
  updateInterval: UPDATE_CHECK_INTERVAL
});
