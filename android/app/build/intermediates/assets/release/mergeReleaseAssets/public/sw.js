// Soulo PWA Service Worker - Enhanced for TWA Updates
const CACHE_NAME = 'soulo-cache-v2'; // Incremented version
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

// Cache bust parameter name
const CACHE_BUST_PARAM = 'v';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v2...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Service worker installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches aggressively
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v2...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete ALL old caches to ensure fresh content
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated - all old caches cleared');
        return self.clients.claim();
      })
  );
});

// Enhanced fetch event with better cache busting
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip Chrome extension requests
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Check if this is a cache-busted request
  const url = new URL(event.request.url);
  const hasCacheBust = url.searchParams.has(CACHE_BUST_PARAM);

  // Skip Supabase API calls for background sync handling
  if (event.request.url.includes('supabase.co/functions') || 
      event.request.url.includes('supabase.co/rest')) {
    
    // Handle offline journal entry creation
    if (event.request.url.includes('transcribe-audio') && navigator.onLine === false) {
      event.respondWith(handleOfflineJournalEntry(event.request));
      return;
    }
    
    // Let network requests pass through normally
    return;
  }

  event.respondWith(
    handleFetchWithCacheBusting(event.request, hasCacheBust)
  );
});

// Enhanced fetch handler with cache busting support
async function handleFetchWithCacheBusting(request, hasCacheBust) {
  try {
    // If cache bust parameter is present, always fetch from network
    if (hasCacheBust) {
      console.log('[SW] Cache-busted request, fetching from network:', request.url);
      
      const response = await fetch(request);
      
      // Cache the fresh response
      if (response && response.status === 200 && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        // Remove cache bust parameter before caching
        const cleanUrl = removeUrlParams(request.url, [CACHE_BUST_PARAM]);
        const cleanRequest = new Request(cleanUrl);
        cache.put(cleanRequest, response.clone());
      }
      
      return response;
    }

    // For manifest.json, always try network first to check for updates
    if (request.url.includes('manifest.json')) {
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone());
          return networkResponse;
        }
      } catch (networkError) {
        console.warn('[SW] Network failed for manifest, trying cache');
      }
    }

    // Try cache first for other requests
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', request.url);
      return cachedResponse;
    }

    // Try network request
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
    
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match(OFFLINE_URL);
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    // Return a generic offline response for other requests
    return new Response('Offline - Content not available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Utility function to remove URL parameters
function removeUrlParams(url, paramsToRemove) {
  const urlObj = new URL(url);
  paramsToRemove.forEach(param => {
    urlObj.searchParams.delete(param);
  });
  return urlObj.toString();
}

// Handle service worker updates more aggressively
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'CLEAR_CACHE') {
    // Clear all caches when requested
    event.waitUntil(clearAllCaches());
  }
});

// Clear all caches function
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => {
        console.log('[SW] Force clearing cache:', cacheName);
        return caches.delete(cacheName);
      })
    );
    console.log('[SW] All caches cleared');
  } catch (error) {
    console.error('[SW] Error clearing caches:', error);
  }
}

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

console.log('[SW] Enhanced service worker script loaded v2');
