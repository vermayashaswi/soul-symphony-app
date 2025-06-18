
// Soulo PWA Service Worker - Enhanced PWA Builder Support
const CACHE_NAME = 'soulo-cache-v1.2.4'; // Incremented for PWA Builder support
const OFFLINE_URL = '/offline.html';
const APP_VERSION = '1.2.4'; // Incremented for PWA Builder support
const UPDATE_CHECK_INTERVAL = 10000; // 10 seconds for better PWA Builder support

// Enhanced assets for PWA Builder compatibility
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

// Enhanced cache-busting for PWA Builder apps
const PWA_BUILDER_CACHE_BUSTING_ROUTES = [
  '/app', '/app/', '/app/home', '/app/journal', 
  '/app/insights', '/app/smart-chat', '/app/settings'
];

function swLog(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[SW PWA BUILDER ${APP_VERSION}] ${timestamp}: ${message}`, data || '');
}

function isPWABuilder() {
  try {
    // Enhanced PWA Builder detection
    const userAgent = self.navigator?.userAgent || '';
    const isPWABuilderUA = userAgent.includes('PWABuilder') || 
                          userAgent.includes('TWA') || 
                          userAgent.includes('WebAPK');
    
    // Check for PWA context indicators
    const standaloneQuery = self.matchMedia && self.matchMedia('(display-mode: standalone)').matches;
    const fullscreenQuery = self.matchMedia && self.matchMedia('(display-mode: fullscreen)').matches;
    
    return isPWABuilderUA || standaloneQuery || fullscreenQuery;
  } catch {
    return false;
  }
}

function isNativeApp() {
  try {
    const userAgent = self.navigator?.userAgent || '';
    return userAgent.includes('SouloNativeApp') || 
           userAgent.includes('Capacitor') ||
           userAgent.includes('wv') ||
           userAgent.includes('WebView') ||
           isPWABuilder();
  } catch {
    return false;
  }
}

// Enhanced install with PWA Builder support
self.addEventListener('install', (event) => {
  swLog('PWA BUILDER: Installing service worker with PWA Builder support');
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        swLog('PWA BUILDER: Caching assets for PWA Builder app');
        return cache.addAll(STATIC_ASSETS);
      }),
      self.skipWaiting()
    ]).then(() => {
      swLog('PWA BUILDER: Service worker installed with PWA Builder support');
    }).catch((error) => {
      swLog('PWA BUILDER: Installation failed', error);
      throw error;
    })
  );
});

// Enhanced activate with aggressive PWA Builder cleanup
self.addEventListener('activate', (event) => {
  swLog('PWA BUILDER: Activating service worker with PWA Builder cleanup');
  
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        const deletePromises = cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            swLog('PWA BUILDER: Deleting old cache for PWA Builder app', cacheName);
            return caches.delete(cacheName);
          }
        }).filter(Boolean);
        
        return Promise.all(deletePromises);
      }),
      self.clients.claim()
    ]).then(async () => {
      swLog('PWA BUILDER: Service worker activated with PWA Builder cleanup');
      
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      swLog(`PWA BUILDER: Notifying ${clients.length} clients (including PWA Builder apps)`);
      
      const isPWABuilderEnv = isPWABuilder();
      const isNativeEnv = isNativeApp();
      
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_ACTIVATED',
          version: APP_VERSION,
          cacheVersion: CACHE_NAME,
          message: 'PWA BUILDER: App updated with PWA Builder support!',
          timestamp: Date.now(),
          forceRefresh: isPWABuilderEnv || isNativeEnv,
          pwaBuilder: isPWABuilderEnv,
          nativeApp: isNativeEnv
        });
      });
      
      // Enhanced PWA Builder refresh logic
      clients.forEach(client => {
        const url = new URL(client.url);
        const isAppRoute = url.pathname.startsWith('/app');
        
        if (isAppRoute || isPWABuilderEnv || isNativeEnv) {
          swLog('PWA BUILDER: Forcing refresh for PWA Builder app route:', url.pathname);
          client.postMessage({
            type: 'FORCE_REFRESH',
            reason: 'PWA BUILDER: Service worker updated for PWA Builder app',
            pwaBuilder: isPWABuilderEnv,
            nativeApp: isNativeEnv
          });
        }
      });
    }).catch(error => {
      swLog('PWA BUILDER: Activation failed', error);
    })
  );
});

// Enhanced fetch with PWA Builder optimization
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;
  if (event.request.url.includes('supabase.co')) return;

  const url = new URL(event.request.url);
  const isAppRoute = url.pathname.startsWith('/app');
  const isPWABuilderCacheBustingRoute = PWA_BUILDER_CACHE_BUSTING_ROUTES.includes(url.pathname);
  const isPWABuilderEnv = isPWABuilder();
  const isNativeEnv = isNativeApp();

  event.respondWith(
    (async () => {
      // Enhanced strategy for PWA Builder apps and app routes
      if (isAppRoute || isPWABuilderCacheBustingRoute || isPWABuilderEnv || isNativeEnv) {
        try {
          swLog(`PWA BUILDER: Network-first strategy for PWA Builder app: ${url.pathname}`);
          
          const networkRequest = new Request(event.request.url, {
            headers: {
              ...Object.fromEntries(event.request.headers.entries()),
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
              'X-PWA-Builder': isPWABuilderEnv ? 'true' : 'false',
              'X-Native-App': isNativeEnv ? 'true' : 'false'
            }
          });
          
          const networkResponse = await fetch(networkRequest);
          
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }
        } catch (error) {
          swLog(`PWA BUILDER: Network failed for PWA Builder app ${url.pathname}`, error);
        }
      }

      // Cache fallback
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        if (isAppRoute || isPWABuilderEnv || isNativeEnv) {
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
        swLog(`PWA BUILDER: Complete fetch failure for ${event.request.url}`, error);
        
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

// Enhanced message handling for PWA Builder apps
self.addEventListener('message', (event) => {
  swLog('PWA BUILDER: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    swLog('PWA BUILDER: Skipping waiting for PWA Builder app');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: APP_VERSION,
      cacheVersion: CACHE_NAME,
      timestamp: Date.now(),
      pwaBuilderSupport: true,
      nativeAppSupport: true
    });
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    swLog('PWA BUILDER: Manual update check for PWA Builder app');
    self.registration.update().then(() => {
      swLog('PWA BUILDER: PWA Builder app update check completed');
    }).catch(error => {
      swLog('PWA BUILDER: PWA Builder app update check failed', error);
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    swLog('PWA BUILDER: Cache clear for PWA Builder app');
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      swLog('PWA BUILDER: PWA Builder app cache cleared');
      event.ports[0].postMessage({ 
        success: true, 
        pwaBuilder: isPWABuilder(),
        nativeApp: isNativeApp() 
      });
    }).catch(error => {
      swLog('PWA BUILDER: PWA Builder app cache clear failed', error);
      event.ports[0].postMessage({ success: false, error: error.message });
    });
  }
});

// Enhanced update checking for PWA Builder apps
let updateCheckInterval;

function startPWABuilderUpdateChecking() {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
  }
  
  swLog('PWA BUILDER: Starting PWA Builder app update checking');
  
  updateCheckInterval = setInterval(async () => {
    try {
      swLog('PWA BUILDER: Performing PWA Builder app update check');
      
      const registration = await self.registration.update();
      
      if (registration.installing || registration.waiting) {
        swLog('PWA BUILDER: New version detected for PWA Builder app');
        
        const clients = await self.clients.matchAll();
        const isPWABuilderEnv = isPWABuilder();
        const isNativeEnv = isNativeApp();
        
        clients.forEach(client => {
          client.postMessage({
            type: 'UPDATE_AVAILABLE',
            version: APP_VERSION,
            message: 'PWA BUILDER: New version available for PWA Builder app',
            pwaBuilder: isPWABuilderEnv,
            nativeApp: isNativeEnv
          });
        });
      }
    } catch (error) {
      swLog('PWA BUILDER: PWA Builder app update check failed', error);
    }
  }, UPDATE_CHECK_INTERVAL);
}

self.addEventListener('activate', () => {
  setTimeout(startPWABuilderUpdateChecking, 2000);
});

swLog('PWA BUILDER: Enhanced service worker loaded with PWA Builder support', { 
  version: APP_VERSION, 
  cache: CACHE_NAME,
  updateInterval: UPDATE_CHECK_INTERVAL,
  pwaBuilderSupport: true,
  nativeAppSupport: true
});
