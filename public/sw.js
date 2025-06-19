
// Soulo PWA Service Worker - Native App Optimized
const CACHE_NAME = 'soulo-cache-v2.1.0';
const APP_VERSION = '2.1.0';
const STATIC_CACHE_NAME = 'soulo-static-v2.1.0';
const DYNAMIC_CACHE_NAME = 'soulo-dynamic-v2.1.0';

// Core static assets - minimal for native apps
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

// Enhanced native app detection
function isNativeApp() {
  try {
    const userAgent = navigator.userAgent;
    return userAgent.includes('wv') || 
           userAgent.includes('WebView') || 
           userAgent.includes('PWABuilder') ||
           userAgent.includes('TWA') ||
           userAgent.includes('WebAPK') ||
           self.location.protocol === 'file:';
  } catch {
    return false;
  }
}

// Install - aggressive caching for native apps
self.addEventListener('install', (event) => {
  swLog('Installing service worker for native app');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        swLog('Caching static assets for native app');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        swLog('Service worker installed, skipping waiting for native app');
        return self.skipWaiting();
      })
      .catch(error => {
        swLog('Installation failed', error);
      })
  );
});

// Activate - aggressive cache cleanup for native apps
self.addEventListener('activate', (event) => {
  swLog('Activating service worker for native app');
  
  event.waitUntil(
    Promise.all([
      // Delete ALL old caches aggressively
      caches.keys().then(cacheNames => {
        const deletePromises = cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
            swLog('Deleting old cache for native app', cacheName);
            return caches.delete(cacheName);
          }
        }).filter(Boolean);
        
        return Promise.all(deletePromises);
      }),
      self.clients.claim()
    ])
    .then(async () => {
      swLog('Service worker activated for native app');
      
      // Notify all clients of activation with native app info
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_ACTIVATED',
          version: APP_VERSION,
          isNativeApp: isNativeApp(),
          timestamp: Date.now()
        });
      });
    })
    .catch(error => {
      swLog('Activation failed', error);
    })
  );
});

// Fetch - optimized for native apps
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and extensions
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;
  if (event.request.url.includes('supabase.co')) return;

  const url = new URL(event.request.url);
  const isAppRoute = NETWORK_FIRST_ROUTES.some(route => url.pathname.startsWith(route));
  const nativeApp = isNativeApp();
  
  event.respondWith(
    (async () => {
      try {
        // For native apps, always try network first with shorter timeout
        if (nativeApp && (isAppRoute || url.pathname.startsWith('/api/'))) {
          swLog(`Native app network first for: ${url.pathname}`);
          
          // Shorter timeout for native apps
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          
          const networkResponse = await fetch(event.request, {
            signal: controller.signal,
            cache: 'no-cache' // Always fetch fresh for native apps
          });
          
          clearTimeout(timeoutId);
          
          if (networkResponse && networkResponse.ok) {
            // Cache successful responses for non-app routes only
            if (!isAppRoute) {
              const cache = await caches.open(DYNAMIC_CACHE_NAME);
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }
        }

        // Try cache for non-native or fallback
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          if (!nativeApp || !isAppRoute) {
            return cachedResponse;
          }
        }

        // Final network attempt
        const networkResponse = await fetch(event.request);
        
        if (networkResponse && networkResponse.ok) {
          // Cache successful responses
          if (!isAppRoute || !nativeApp) {
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

// Enhanced message handling for native apps
self.addEventListener('message', (event) => {
  swLog('Message received from native app', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    swLog('Skipping waiting for native app');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    swLog('Clearing all caches for native app');
    caches.keys().then(cacheNames => {
      return Promise.all(cacheNames.map(name => caches.delete(name)));
    }).then(() => {
      swLog('All caches cleared for native app');
      event.ports[0]?.postMessage({ success: true });
    });
  }
  
  if (event.data && event.data.type === 'NATIVE_APP_READY') {
    swLog('Native app ready, optimizing service worker behavior');
    // Could add native-specific optimizations here
  }
});

swLog('Service worker loaded for native app', { version: APP_VERSION, isNativeApp: isNativeApp() });
