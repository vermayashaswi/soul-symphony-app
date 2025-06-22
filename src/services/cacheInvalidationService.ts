
import { detectTWAEnvironment } from '@/utils/twaDetection';
import { toast } from 'sonner';

export interface CacheInvalidationResult {
  success: boolean;
  method: string;
  timestamp: number;
  error?: string;
}

class CacheInvalidationService {
  private readonly CACHE_VERSION_KEY = 'cache_version';
  private readonly MANIFEST_VERSION_KEY = 'manifest_version';
  private currentVersion: string = '1.0.1';

  /**
   * Invalidate all caches using multiple strategies
   */
  async invalidateAllCaches(): Promise<CacheInvalidationResult[]> {
    const results: CacheInvalidationResult[] = [];
    const timestamp = Date.now();

    console.log('[Cache Invalidation] Starting comprehensive cache invalidation');

    // Strategy 1: Clear Service Worker caches
    results.push(await this.clearServiceWorkerCaches(timestamp));

    // Strategy 2: Clear browser storage
    results.push(await this.clearBrowserStorage(timestamp));

    // Strategy 3: Force manifest refresh
    results.push(await this.forceManifestRefresh(timestamp));

    // Strategy 4: Bust application cache
    results.push(await this.bustApplicationCache(timestamp));

    // Strategy 5: Clear IndexedDB (if used)
    results.push(await this.clearIndexedDB(timestamp));

    const successCount = results.filter(r => r.success).length;
    console.log(`[Cache Invalidation] Completed: ${successCount}/${results.length} strategies succeeded`);

    return results;
  }

  /**
   * Clear all Service Worker caches
   */
  private async clearServiceWorkerCaches(timestamp: number): Promise<CacheInvalidationResult> {
    try {
      if (!('caches' in window)) {
        return {
          success: false,
          method: 'service-worker-caches',
          timestamp,
          error: 'Cache API not supported'
        };
      }

      const cacheNames = await caches.keys();
      console.log('[Cache Invalidation] Found caches:', cacheNames);

      const deletePromises = cacheNames.map(async (cacheName) => {
        console.log('[Cache Invalidation] Deleting cache:', cacheName);
        return await caches.delete(cacheName);
      });

      await Promise.all(deletePromises);

      return {
        success: true,
        method: 'service-worker-caches',
        timestamp
      };
    } catch (error) {
      console.error('[Cache Invalidation] Error clearing SW caches:', error);
      return {
        success: false,
        method: 'service-worker-caches',
        timestamp,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Clear relevant browser storage
   */
  private async clearBrowserStorage(timestamp: number): Promise<CacheInvalidationResult> {
    try {
      // Preserve essential user data
      const preserveKeys = [
        'auth_session',
        'user_profile',
        'subscription_status',
        'onboarding_complete',
        'app_version',
        'manifest_version'
      ];

      // Clear localStorage except preserved keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !preserveKeys.includes(key)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => {
        console.log('[Cache Invalidation] Removing localStorage key:', key);
        localStorage.removeItem(key);
      });

      // Clear sessionStorage (less critical)
      sessionStorage.clear();

      // Update cache version
      localStorage.setItem(this.CACHE_VERSION_KEY, timestamp.toString());

      return {
        success: true,
        method: 'browser-storage',
        timestamp
      };
    } catch (error) {
      console.error('[Cache Invalidation] Error clearing browser storage:', error);
      return {
        success: false,
        method: 'browser-storage',
        timestamp,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Force refresh the PWA manifest
   */
  private async forceManifestRefresh(timestamp: number): Promise<CacheInvalidationResult> {
    try {
      const manifestUrl = `/app/manifest.json?v=${timestamp}`;
      
      const response = await fetch(manifestUrl, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });

      if (response.ok) {
        const manifest = await response.json();
        const newVersion = manifest.version || this.currentVersion;
        
        // Store new manifest version
        localStorage.setItem(this.MANIFEST_VERSION_KEY, newVersion);
        console.log('[Cache Invalidation] Manifest refreshed, version:', newVersion);

        return {
          success: true,
          method: 'manifest-refresh',
          timestamp
        };
      } else {
        throw new Error(`Manifest fetch failed: ${response.status}`);
      }
    } catch (error) {
      console.error('[Cache Invalidation] Error refreshing manifest:', error);
      return {
        success: false,
        method: 'manifest-refresh',
        timestamp,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Bust application cache by adding timestamp to critical resources
   */
  private async bustApplicationCache(timestamp: number): Promise<CacheInvalidationResult> {
    try {
      // Force reload critical stylesheets
      const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
      stylesheets.forEach((link) => {
        const href = (link as HTMLLinkElement).href;
        if (href && !href.includes('?v=')) {
          (link as HTMLLinkElement).href = `${href}?v=${timestamp}`;
        }
      });

      // Update meta tags for caching
      this.updateCacheMetaTags(timestamp);

      return {
        success: true,
        method: 'application-cache-bust',
        timestamp
      };
    } catch (error) {
      console.error('[Cache Invalidation] Error busting application cache:', error);
      return {
        success: false,
        method: 'application-cache-bust',
        timestamp,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Clear IndexedDB if present
   */
  private async clearIndexedDB(timestamp: number): Promise<CacheInvalidationResult> {
    try {
      if (!('indexedDB' in window)) {
        return {
          success: true,
          method: 'indexeddb-clear',
          timestamp,
          error: 'IndexedDB not supported (not an error)'
        };
      }

      // Try to clear common IndexedDB stores
      const commonDBNames = ['app-cache', 'journal-cache', 'user-data'];
      
      for (const dbName of commonDBNames) {
        try {
          const deleteRequest = indexedDB.deleteDatabase(dbName);
          await new Promise((resolve, reject) => {
            deleteRequest.onsuccess = () => resolve(true);
            deleteRequest.onerror = () => reject(deleteRequest.error);
            deleteRequest.onblocked = () => resolve(true); // Consider blocked as success
          });
          console.log('[Cache Invalidation] Cleared IndexedDB:', dbName);
        } catch (error) {
          console.log('[Cache Invalidation] IndexedDB not found or error:', dbName, error);
        }
      }

      return {
        success: true,
        method: 'indexeddb-clear',
        timestamp
      };
    } catch (error) {
      console.error('[Cache Invalidation] Error clearing IndexedDB:', error);
      return {
        success: false,
        method: 'indexeddb-clear',
        timestamp,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update cache-related meta tags
   */
  private updateCacheMetaTags(timestamp: number): void {
    const metaTags = [
      { name: 'cache-control', content: 'no-cache, no-store, must-revalidate' },
      { name: 'pragma', content: 'no-cache' },
      { name: 'expires', content: '0' },
      { name: 'app-version', content: this.currentVersion },
      { name: 'cache-timestamp', content: timestamp.toString() }
    ];

    metaTags.forEach(({ name, content }) => {
      let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = name;
        document.head.appendChild(meta);
      }
      meta.content = content;
    });
  }

  /**
   * Check if cache invalidation is needed
   */
  async shouldInvalidateCache(): Promise<boolean> {
    try {
      const storedVersion = localStorage.getItem(this.MANIFEST_VERSION_KEY);
      const storedCacheVersion = localStorage.getItem(this.CACHE_VERSION_KEY);
      
      // Check if we have a stored version
      if (!storedVersion || !storedCacheVersion) {
        console.log('[Cache Invalidation] No stored version found, invalidation needed');
        return true;
      }

      // Check against current version
      if (storedVersion !== this.currentVersion) {
        console.log('[Cache Invalidation] Version mismatch:', storedVersion, 'vs', this.currentVersion);
        return true;
      }

      // Check cache age (invalidate if older than 1 hour in TWA)
      const twaEnv = detectTWAEnvironment();
      if (twaEnv.isTWA || twaEnv.isStandalone) {
        const cacheAge = Date.now() - parseInt(storedCacheVersion, 10);
        const oneHour = 60 * 60 * 1000;
        
        if (cacheAge > oneHour) {
          console.log('[Cache Invalidation] Cache too old in TWA environment');
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('[Cache Invalidation] Error checking cache status:', error);
      return true; // Err on the side of invalidation
    }
  }

  /**
   * Perform a hard refresh after cache invalidation
   */
  async performHardRefresh(): Promise<void> {
    console.log('[Cache Invalidation] Performing hard refresh...');
    
    const twaEnv = detectTWAEnvironment();
    
    if (twaEnv.isTWA || twaEnv.isStandalone) {
      // For TWA, show notification before refresh
      toast.success('App updated! Refreshing...', { duration: 2000 });
      
      setTimeout(() => {
        const cacheBustValue = Date.now();
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('v', cacheBustValue.toString());
        currentUrl.searchParams.set('cache_bust', '1');
        
        window.location.href = currentUrl.toString();
      }, 2000);
    } else {
      // For web browsers, immediate refresh
      window.location.reload();
    }
  }

  /**
   * Get current cache status
   */
  getCacheStatus(): {
    version: string;
    lastInvalidation: string | null;
    manifestVersion: string | null;
  } {
    return {
      version: this.currentVersion,
      lastInvalidation: localStorage.getItem(this.CACHE_VERSION_KEY),
      manifestVersion: localStorage.getItem(this.MANIFEST_VERSION_KEY)
    };
  }
}

export const cacheInvalidationService = new CacheInvalidationService();
