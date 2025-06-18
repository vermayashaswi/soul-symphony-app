// Soulo PWA Service Worker - Enhanced for Aggressive Updates
const CACHE_NAME = 'soulo-cache-v' + Date.now(); // Dynamic cache name for forced updates
const OFFLINE_URL = '/offline.html';
const BACKGROUND_SYNC_TAG = 'journal-entry-sync';
const PERIODIC_SYNC_TAG = 'journal-periodic-sync';
const INSIGHTS_SYNC_TAG = 'insights-periodic-sync';

// Force immediate activation
const AGGRESSIVE_UPDATE_MODE = true;

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

// Install event - aggressive caching
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker with aggressive updates...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Caching static assets with new cache name:', CACHE_NAME);
        return cache.addAll(STATIC_ASSETS);
      }),
      // Skip waiting immediately for aggressive updates
      AGGRESSIVE_UPDATE_MODE ? self.skipWaiting() : Promise.resolve()
    ]).then(() => {
      console.log('[SW] Service worker installed successfully');
    }).catch((error) => {
      console.error('[SW] Installation failed:', error);
    })
  );
});

// Activate event - aggressive cleanup and immediate takeover
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker with aggressive cleanup...');
  
  event.waitUntil(
    Promise.all([
      // Delete ALL old caches aggressively
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Aggressively deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim all clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('[SW] Service worker activated aggressively');
      // Notify all clients about the update
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            timestamp: Date.now(),
            cacheVersion: CACHE_NAME
          });
        });
      });
    })
  );
});

// Enhanced fetch event with aggressive cache busting
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip Chrome extension requests
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Aggressive cache busting for API calls
  if (event.request.url.includes('supabase.co/functions') || 
      event.request.url.includes('supabase.co/rest')) {
    
    // Handle offline journal entry creation
    if (event.request.url.includes('transcribe-audio') && navigator.onLine === false) {
      event.respondWith(handleOfflineJournalEntry(event.request));
      return;
    }
    
    // Add cache-busting headers for API calls
    event.respondWith(
      fetch(event.request.clone(), {
        headers: {
          ...event.request.headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }).catch(() => {
        // Fallback to cached version if available
        return caches.match(event.request);
      })
    );
    return;
  }

  // Aggressive caching strategy for static assets
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(response => {
        if (response) {
          // Serve from cache but also update in background
          const fetchPromise = fetch(event.request).then(fetchResponse => {
            if (fetchResponse && fetchResponse.status === 200 && fetchResponse.type === 'basic') {
              cache.put(event.request, fetchResponse.clone());
            }
            return fetchResponse;
          }).catch(() => response);
          
          // Return cached version immediately
          return response;
        }

        // Not in cache, fetch from network
        return fetch(event.request).then(fetchResponse => {
          if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
            return fetchResponse;
          }

          // Cache the new response
          cache.put(event.request, fetchResponse.clone());
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
      });
    })
  );
});

// Enhanced message handling for aggressive updates
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skipping waiting due to aggressive update request');
    self.skipWaiting();
  } else if (event.data && event.data.type === 'CHECK_UPDATE') {
    // Force an immediate update check
    event.ports[0].postMessage({
      type: 'UPDATE_STATUS',
      hasUpdate: true,
      timestamp: Date.now()
    });
  }
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
    
    // Check if this is an update notification
    if (data.type === 'APP_UPDATE') {
      const options = {
        body: 'A new version of Soulo is available. Tap to update now.',
        icon: '/lovable-uploads/31ed88ef-f596-4b91-ba58-a4175eebe779.png',
        badge: '/lovable-uploads/31ed88ef-f596-4b91-ba58-a4175eebe779.png',
        tag: 'app-update',
        requireInteraction: true,
        actions: [
          {
            action: 'update',
            title: 'Update Now',
            icon: '/lovable-uploads/31ed88ef-f596-4b91-ba58-a4175eebe779.png'
          },
          {
            action: 'later',
            title: 'Later',
            icon: '/lovable-uploads/31ed88ef-f596-4b91-ba58-a4175eebe779.png'
          }
        ],
        data: { type: 'APP_UPDATE' }
      };

      event.waitUntil(
        self.registration.showNotification('Soulo Update Available', options)
      );
      return;
    }
    
    // Handle regular notifications
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
  
  if (event.notification.data?.type === 'APP_UPDATE') {
    if (event.action === 'update') {
      // Force immediate update
      event.waitUntil(
        self.skipWaiting().then(() => {
          return self.clients.claim();
        }).then(() => {
          return self.clients.matchAll();
        }).then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'FORCE_RELOAD' });
          });
        })
      );
    }
    return;
  }
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/app')
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    console.log('[SW] Notification dismissed');
  }
});

// Auto-sync functionality - keep existing code
async function syncJournalEntries() {
  // ... keep existing code (syncJournalEntries function)
}

async function periodicJournalSync() {
  // ... keep existing code (periodicJournalSync function)
}

async function periodicInsightsSync() {
  // ... keep existing code (periodicInsightsSync function)
}

async function refreshInsightsCache() {
  // ... keep existing code (refreshInsightsCache function)
}

async function getOfflineJournalEntries() {
  // ... keep existing code (getOfflineJournalEntries function)
}

async function removeOfflineJournalEntry(id) {
  // ... keep existing code (removeOfflineJournalEntry function)
}

async function notifyAppOfSync(entry, status) {
  // ... keep existing code (notifyAppOfSync function)
}

async function notifyAppOfPeriodicSync(type, itemCount) {
  // ... keep existing code (notifyAppOfPeriodicSync function)
}

console.log('[SW] Enhanced service worker script loaded with aggressive updates');
