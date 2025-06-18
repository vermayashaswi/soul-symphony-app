
// Soulo PWA Service Worker - Enhanced Native App Support
const CACHE_NAME = 'soulo-cache-v1.2.3'; // Incremented for native app fixes
const OFFLINE_URL = '/offline.html';
const APP_VERSION = '1.2.3'; // Incremented for native app fixes
const UPDATE_CHECK_INTERVAL = 15000; // 15 seconds for better native app support

// Enhanced assets for native app compatibility
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
  '/app/manifest.json',
  '/lovable-uploads/31ed88ef-f596-4b91-ba58-a4175eebe779.png',
  '/lovable-uploads/3f275134-f471-4af9-a7cd-700ccd855fe3.png'
];

// Enhanced cache-busting for native apps
const NATIVE_CACHE_BUSTING_ROUTES = [
  '/app', '/app/', '/app/home', '/app/journal', 
  '/app/insights', '/app/smart-chat', '/app/settings'
];

function swLog(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[SW NATIVE FIX ${APP_VERSION}] ${timestamp}: ${message}`, data || '');
}

function isNativeApp() {
  try {
    const userAgent = self.navigator?.userAgent || '';
    return userAgent.includes('SouloNativeApp') || 
           userAgent.includes('Capacitor') ||
           userAgent.includes('wv') ||
           userAgent.includes('WebView');
  } catch {
    return false;
  }
}

// Enhanced install with native app support
self.addEventListener('install', (event) => {
  swLog('NATIVE FIX: Installing service worker with native app support');
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        swLog('NATIVE FIX: Caching assets for native app');
        return cache.addAll(STATIC_ASSETS);
      }),
      self.skipWaiting()
    ]).then(() => {
      swLog('NATIVE FIX: Service worker installed with native app support');
    }).catch((error) => {
      swLog('NATIVE FIX: Installation failed', error);
      throw error;
    })
  );
});

// Enhanced activate with aggressive native app cleanup
self.addEventListener('activate', (event) => {
  swLog('NATIVE FIX: Activating service worker with native app cleanup');
  
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        const deletePromises = cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            swLog('NATIVE FIX: Deleting old cache for native app', cacheName);
            return caches.delete(cacheName);
          }
        }).filter(Boolean);
        
        return Promise.all(deletePromises);
      }),
      self.clients.claim()
    ]).then(async () => {
      swLog('NATIVE FIX: Service worker activated with native app cleanup');
      
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      swLog(`NATIVE FIX: Notifying ${clients.length} clients (including native apps)`);
      
      clients.forEach(client => {
        const isNative = isNativeApp();
        
        client.postMessage({
          type: 'SW_ACTIVATED',
          version: APP_VERSION,
          cacheVersion: CACHE_NAME,
          message: 'NATIVE FIX: App updated with native support!',
          timestamp: Date.now(),
          forceRefresh: isNative, // Force refresh for native apps
          nativeApp: isNative
        });
      });
      
      // Enhanced native app refresh logic
      clients.forEach(client => {
        const url = new URL(client.url);
        const isAppRoute = url.pathname.startsWith('/app');
        
        if (isAppRoute || isNativeApp()) {
          swLog('NATIVE FIX: Forcing refresh for native app route:', url.pathname);
          client.postMessage({
            type: 'FORCE_REFRESH',
            reason: 'NATIVE FIX: Service worker updated for native app',
            nativeApp: isNativeApp()
          });
        }
      });
    }).catch(error => {
      swLog('NATIVE FIX: Activation failed', error);
    })
  );
});

// Enhanced fetch with native app optimization
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;
  if (event.request.url.includes('supabase.co')) return;

  const url = new URL(event.request.url);
  const isAppRoute = url.pathname.startsWith('/app');
  const isNativeCacheBustingRoute = NATIVE_CACHE_BUSTING_ROUTES.includes(url.pathname);
  const isNative = isNativeApp();

  event.respondWith(
    (async () => {
      // Enhanced strategy for native apps and app routes
      if (isAppRoute || isNativeCacheBustingRoute || isNative) {
        try {
          swLog(`NATIVE FIX: Network-first strategy for native app: ${url.pathname}`);
          
          const networkRequest = new Request(event.request.url, {
            headers: {
              ...event.request.headers,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
              'X-Native-App': isNative ? 'true' : 'false'
            }
          });
          
          const networkResponse = await fetch(networkRequest);
          
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }
        } catch (error) {
          swLog(`NATIVE FIX: Network failed for native app ${url.pathname}`, error);
        }
      }

      // Cache fallback
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        if (isAppRoute || isNative) {
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

      // Network fallback
      try {
        const networkResponse = await fetch(event.request);
        
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }
        
        return networkResponse;
      } catch (error) {
        swLog(`NATIVE FIX: Complete fetch failure for ${event.request.url}`, error);
        
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

// Enhanced message handling for native apps
self.addEventListener('message', (event) => {
  swLog('NATIVE FIX: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    swLog('NATIVE FIX: Skipping waiting for native app');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: APP_VERSION,
      cacheVersion: CACHE_NAME,
      timestamp: Date.now(),
      nativeAppSupport: true
    });
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    swLog('NATIVE FIX: Manual update check for native app');
    self.registration.update().then(() => {
      swLog('NATIVE FIX: Native app update check completed');
    }).catch(error => {
      swLog('NATIVE FIX: Native app update check failed', error);
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    swLog('NATIVE FIX: Cache clear for native app');
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      swLog('NATIVE FIX: Native app cache cleared');
      event.ports[0].postMessage({ success: true, nativeApp: isNativeApp() });
    }).catch(error => {
      swLog('NATIVE FIX: Native app cache clear failed', error);
      event.ports[0].postMessage({ success: false, error: error.message });
    });
  }
});

// Enhanced update checking for native apps
let updateCheckInterval;

function startNativeAppUpdateChecking() {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
  }
  
  swLog('NATIVE FIX: Starting native app update checking');
  
  updateCheckInterval = setInterval(async () => {
    try {
      swLog('NATIVE FIX: Performing native app update check');
      
      const registration = await self.registration.update();
      
      if (registration.installing || registration.waiting) {
        swLog('NATIVE FIX: New version detected for native app');
        
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'UPDATE_AVAILABLE',
            version: APP_VERSION,
            message: 'NATIVE FIX: New version available for native app',
            nativeApp: isNativeApp()
          });
        });
      }
    } catch (error) {
      swLog('NATIVE FIX: Native app update check failed', error);
    }
  }, UPDATE_CHECK_INTERVAL);
}

self.addEventListener('activate', () => {
  setTimeout(startNativeAppUpdateChecking, 3000);
});

swLog('NATIVE FIX: Enhanced service worker loaded with native app support', { 
  version: APP_VERSION, 
  cache: CACHE_NAME,
  updateInterval: UPDATE_CHECK_INTERVAL,
  nativeAppSupport: true
});
