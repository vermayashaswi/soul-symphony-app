
// Soulo PWA Service Worker - Auto-Update Version with Theme Consistency
const CACHE_NAME = 'soulo-cache-v1.1.1';
const OFFLINE_URL = '/offline.html';

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

// Install event - skip waiting immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installing new service worker with theme consistency...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      console.log('[SW] Service worker installed, skipping waiting...');
      // Skip waiting immediately for faster updates
      return self.skipWaiting();
    }).catch((error) => {
      console.error('[SW] Installation failed:', error);
    })
  );
});

// Activate event - claim clients immediately
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new service worker...');
  
  event.waitUntil(
    Promise.all([
      // Clear old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim all clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('[SW] Service worker activated and claimed all clients');
      
      // Notify all clients about the update
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            message: 'Service worker updated with theme consistency fixes'
          });
        });
      });
    })
  );
});

// Fetch event with proper API handling
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip Chrome extension requests
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Don't interfere with Supabase API calls - let them go through normally
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response;
      }

      return fetch(event.request).then(fetchResponse => {
        // Don't cache non-successful responses
        if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
          return fetchResponse;
        }

        // Cache successful responses for static assets
        const responseToCache = fetchResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return fetchResponse;
      }).catch(() => {
        // Return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        
        return new Response('Offline - Content not available', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    })
  );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skipping waiting due to app request');
    self.skipWaiting();
  }
});

// Periodic update check (every 30 seconds when page is active)
let updateCheckInterval;

function startUpdateChecking() {
  if (updateCheckInterval) return;
  
  updateCheckInterval = setInterval(async () => {
    try {
      // Check if there's a newer version available
      const response = await fetch('/sw.js', { cache: 'no-cache' });
      if (response.ok) {
        const newSwContent = await response.text();
        const currentVersion = CACHE_NAME;
        
        // Simple version check based on cache name in the new SW
        if (newSwContent.includes('soulo-cache-v') && !newSwContent.includes(currentVersion)) {
          console.log('[SW] New version detected, triggering update...');
          
          // Clear current cache
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
          
          // Trigger service worker update
          self.registration.update();
        }
      }
    } catch (error) {
      console.error('[SW] Error checking for updates:', error);
    }
  }, 30000); // Check every 30 seconds
}

// Start checking when SW becomes active
self.addEventListener('activate', startUpdateChecking);

// Stop checking when SW is being replaced
self.addEventListener('install', () => {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
});
