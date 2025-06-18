
// Soulo PWA Service Worker - Enhanced Update Detection with PWABuilder Compatibility
const CACHE_NAME = 'soulo-cache-v1.2.0'; // Updated version to match app version
const OFFLINE_URL = '/offline.html';
const APP_VERSION = '1.2.0'; // Explicit version tracking

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

// Enhanced logging for debugging
function swLog(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[SW ${APP_VERSION}] ${timestamp}: ${message}`, data || '');
}

// Install event - enhanced with better logging
self.addEventListener('install', (event) => {
  swLog('Installing new service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      swLog('Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      swLog('Service worker installed successfully, forcing activation');
      // Force immediate activation for faster updates
      return self.skipWaiting();
    }).catch((error) => {
      swLog('Installation failed', error);
      throw error;
    })
  );
});

// Activate event - enhanced cleanup and client notification
self.addEventListener('activate', (event) => {
  swLog('Activating new service worker...');
  
  event.waitUntil(
    Promise.all([
      // Clear old caches with better logging
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
      swLog('Service worker activated and claimed all clients');
      
      // Enhanced client notification with version info
      const clients = await self.clients.matchAll();
      swLog(`Notifying ${clients.length} clients of update`);
      
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_UPDATED',
          version: APP_VERSION,
          cacheVersion: CACHE_NAME,
          message: 'App updated successfully!',
          timestamp: Date.now()
        });
      });
      
      // Also notify about successful activation
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_ACTIVATED',
          version: APP_VERSION,
          message: 'New version is now active'
        });
      });
    }).catch(error => {
      swLog('Activation failed', error);
    })
  );
});

// Enhanced fetch event with better error handling
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

  // Enhanced cache strategy with logging
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        // swLog(`Serving from cache: ${event.request.url}`);
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
      }).catch(error => {
        swLog(`Fetch failed for ${event.request.url}`, error);
        
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

// Enhanced message handling
self.addEventListener('message', (event) => {
  swLog('Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    swLog('Skipping waiting due to app request');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    // Respond with current version info
    event.ports[0].postMessage({
      version: APP_VERSION,
      cacheVersion: CACHE_NAME,
      timestamp: Date.now()
    });
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    swLog('Manual update check requested');
    // Trigger update check
    self.registration.update().then(() => {
      swLog('Update check completed');
    }).catch(error => {
      swLog('Update check failed', error);
    });
  }
});

// Enhanced periodic update checking
let updateCheckInterval;
let isUpdateCheckActive = false;

function startUpdateChecking() {
  if (updateCheckInterval || isUpdateCheckActive) {
    swLog('Update checking already active');
    return;
  }
  
  swLog('Starting periodic update checks');
  isUpdateCheckActive = true;
  
  updateCheckInterval = setInterval(async () => {
    try {
      swLog('Performing periodic update check');
      
      // Check for new service worker version
      const registration = await self.registration.update();
      
      if (registration.installing || registration.waiting) {
        swLog('New service worker version detected');
        
        // Notify clients about available update
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'UPDATE_AVAILABLE',
            version: APP_VERSION,
            message: 'A new version is available'
          });
        });
      }
    } catch (error) {
      swLog('Periodic update check failed', error);
    }
  }, 60000); // Check every 60 seconds
}

function stopUpdateChecking() {
  if (updateCheckInterval) {
    swLog('Stopping periodic update checks');
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
    isUpdateCheckActive = false;
  }
}

// Start checking when SW becomes active
self.addEventListener('activate', () => {
  setTimeout(startUpdateChecking, 5000); // Start after 5 seconds
});

// Stop checking when SW is being replaced
self.addEventListener('install', () => {
  stopUpdateChecking();
});

// PWABuilder compatibility - handle background sync if available
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

swLog('Service worker script loaded', { version: APP_VERSION, cache: CACHE_NAME });
