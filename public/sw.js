
// Soulo PWA Service Worker with Dynamic Versioning
const APP_VERSION = '1.2.0'; // Increment this for force updates
const CACHE_NAME = `soulo-cache-v${APP_VERSION}`;
const OFFLINE_URL = '/offline.html';
const BACKGROUND_SYNC_TAG = 'journal-entry-sync';
const PERIODIC_SYNC_TAG = 'journal-periodic-sync';
const INSIGHTS_SYNC_TAG = 'insights-periodic-sync';

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

// Install event - cache static assets and skip waiting
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing service worker version ${APP_VERSION}...`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Service worker installed successfully');
        // Force immediate activation
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating service worker version ${APP_VERSION}...`);
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName.startsWith('soulo-cache-')) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim all clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('[SW] Service worker activated and claiming clients');
      
      // Notify all clients about the update
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: APP_VERSION
          });
        });
      });
    })
  );
});

// Fetch event - serve from cache or network with cache-busting for dynamic content
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip Chrome extension requests
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Handle API requests (Supabase) with cache-busting
  if (event.request.url.includes('supabase.co') || 
      event.request.url.includes('/functions/')) {
    
    event.respondWith(
      fetch(event.request.clone(), {
        headers: {
          ...Object.fromEntries(event.request.headers.entries()),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      }).catch(() => {
        // Return cached version if available during offline
        return caches.match(event.request);
      })
    );
    return;
  }

  // Handle app routes and static assets
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // For app routes, always try network first to get fresh content
        if (event.request.url.includes('/app/') || 
            event.request.url.endsWith('/app')) {
          
          return fetch(event.request.clone(), {
            headers: {
              'Cache-Control': 'no-cache'
            }
          }).then((networkResponse) => {
            // Cache the fresh response
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          }).catch(() => {
            // Fallback to cache if network fails
            return response || caches.match('/offline.html');
          });
        }

        // For static assets, return cached version if available
        if (response) {
          console.log('[SW] Serving from cache:', event.request.url);
          return response;
        }

        // Try network request for non-cached resources
        return fetch(event.request.clone())
          .then((networkResponse) => {
            // Don't cache non-successful responses
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Clone the response for caching
            const responseToCache = networkResponse.clone();
            
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });

            return networkResponse;
          })
          .catch(() => {
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

// Background Sync for journal entries
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === BACKGROUND_SYNC_TAG) {
    event.waitUntil(syncJournalEntries());
  }
});

// Periodic Background Sync
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync triggered:', event.tag);
  
  if (event.tag === PERIODIC_SYNC_TAG) {
    event.waitUntil(periodicJournalSync());
  } else if (event.tag === INSIGHTS_SYNC_TAG) {
    event.waitUntil(periodicInsightsSync());
  }
});

// Handle offline journal entry creation
async function handleOfflineJournalEntry(request) {
  try {
    const requestData = await request.json();
    
    // Store the journal entry data in IndexedDB for later sync
    await storeOfflineJournalEntry({
      ...requestData,
      timestamp: Date.now(),
      offline: true
    });

    // Register background sync
    await self.registration.sync.register(BACKGROUND_SYNC_TAG);

    // Return success response
    return new Response(JSON.stringify({
      success: true,
      offline: true,
      message: 'Journal entry saved offline. Will sync when online.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[SW] Error handling offline journal entry:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to save offline journal entry'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Store offline journal entry in IndexedDB
async function storeOfflineJournalEntry(entryData) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SouloOfflineDB', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['journalEntries'], 'readwrite');
      const store = transaction.objectStore('journalEntries');
      
      const addRequest = store.add(entryData);
      addRequest.onsuccess = () => resolve(addRequest.result);
      addRequest.onerror = () => reject(addRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('journalEntries')) {
        const store = db.createObjectStore('journalEntries', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('offline', 'offline', { unique: false });
      }
    };
  });
}

// Sync journal entries when back online
async function syncJournalEntries() {
  try {
    console.log('[SW] Starting journal entries sync...');
    
    const entries = await getOfflineJournalEntries();
    
    for (const entry of entries) {
      try {
        // Attempt to send the journal entry to the server
        const response = await fetch('/functions/v1/transcribe-audio', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(entry)
        });

        if (response.ok) {
          // Successfully synced, remove from offline storage
          await removeOfflineJournalEntry(entry.id);
          console.log('[SW] Successfully synced journal entry:', entry.id);
          
          // Notify the app about successful sync
          await notifyAppOfSync(entry, 'success');
        } else {
          console.error('[SW] Failed to sync journal entry:', entry.id, response.status);
        }
        
      } catch (error) {
        console.error('[SW] Error syncing journal entry:', entry.id, error);
      }
    }
    
    console.log('[SW] Journal entries sync completed');
    
  } catch (error) {
    console.error('[SW] Error during sync process:', error);
  }
}

// Periodic sync for journal entries
async function periodicJournalSync() {
  try {
    console.log('[SW] Starting periodic journal sync...');
    
    // Check if there are any pending offline entries
    const pendingEntries = await getOfflineJournalEntries();
    
    if (pendingEntries.length > 0) {
      console.log('[SW] Found pending entries during periodic sync:', pendingEntries.length);
      await syncJournalEntries();
    }
    
    // Notify app about periodic sync completion
    await notifyAppOfPeriodicSync('journal', pendingEntries.length);
    
  } catch (error) {
    console.error('[SW] Error during periodic journal sync:', error);
  }
}

// Periodic sync for insights refresh
async function periodicInsightsSync() {
  try {
    console.log('[SW] Starting periodic insights sync...');
    
    // Trigger insights cache refresh
    await refreshInsightsCache();
    
    // Notify app about insights sync
    await notifyAppOfPeriodicSync('insights', 0);
    
  } catch (error) {
    console.error('[SW] Error during periodic insights sync:', error);
  }
}

// Refresh insights cache
async function refreshInsightsCache() {
  const insightUrls = [
    '/functions/v1/get-insights',
    '/functions/v1/get-emotion-data',
    '/functions/v1/get-journal-stats'
  ];
  
  for (const url of insightUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        // Cache the fresh data
        const cache = await caches.open(CACHE_NAME);
        await cache.put(url, response.clone());
        console.log('[SW] Refreshed cache for:', url);
      }
    } catch (error) {
      console.error('[SW] Failed to refresh cache for:', url, error);
    }
  }
}

// Get offline journal entries from IndexedDB
async function getOfflineJournalEntries() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SouloOfflineDB', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['journalEntries'], 'readonly');
      const store = transaction.objectStore('journalEntries');
      const index = store.index('offline');
      
      const getRequest = index.getAll(IDBKeyRange.only(true));
      getRequest.onsuccess = () => resolve(getRequest.result || []);
      getRequest.onerror = () => reject(getRequest.error);
    };
  });
}

// Remove synced journal entry from offline storage
async function removeOfflineJournalEntry(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SouloOfflineDB', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['journalEntries'], 'readwrite');
      const store = transaction.objectStore('journalEntries');
      
      const deleteRequest = store.delete(id);
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}

// Notify the app about sync status
async function notifyAppOfSync(entry, status) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'JOURNAL_SYNC_STATUS',
      payload: { entry, status }
    });
  });
}

// Notify the app about periodic sync
async function notifyAppOfPeriodicSync(type, itemCount) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'PERIODIC_SYNC_STATUS',
      payload: { type, itemCount, timestamp: Date.now() }
    });
  });
}

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'New notification from Soulo',
      icon: '/lovable-uploads/31ed88ef-f596-4b91-ba58-a4175eebe779.png',
      badge: '/lovable-uploads/31ed88ef-f596-4b91-ba58-a4175eebe779.png',
      tag: 'soulo-notification',
      requireInteraction: false,
      actions: [
        {
          action: 'open',
          title: 'Open App',
          icon: '/lovable-uploads/31ed88ef-f596-4b91-ba58-a4175eebe779.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/lovable-uploads/31ed88ef-f596-4b91-ba58-a4175eebe779.png'
        }
      ],
      data: data.data || {}
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Soulo', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received');
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/app')
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    console.log('[SW] Notification dismissed');
  }
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'GET_VERSION') {
    // Respond with current service worker version
    event.ports[0].postMessage({
      type: 'VERSION_RESPONSE',
      version: APP_VERSION
    });
  } else if (event.data && event.data.type === 'CLEAR_CACHE') {
    // Clear all caches on request
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }).then(() => {
      event.ports[0].postMessage({
        type: 'CACHE_CLEARED'
      });
    });
  }
});

console.log(`[SW] Service worker script loaded - Version ${APP_VERSION}`);
