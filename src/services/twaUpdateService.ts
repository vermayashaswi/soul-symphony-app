
import { detectTWAEnvironment } from '@/utils/twaDetection';
import { toast } from 'sonner';
import { cacheInvalidationService } from './cacheInvalidationService';

export interface UpdateInfo {
  available: boolean;
  version?: string;
  timestamp?: number;
}

class TWAUpdateService {
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private lastUpdateCheck: number = 0;
  private readonly CHECK_INTERVAL = 3 * 60 * 1000; // 3 minutes for more frequent checks
  private readonly CACHE_BUST_PARAM = 'v';

  /**
   * Initialize update checking for TWA environment
   */
  init(): void {
    const twaEnv = detectTWAEnvironment();
    
    if (twaEnv.isTWA || twaEnv.isStandalone) {
      console.log('[TWA Update] Initializing enhanced update service with cache invalidation');
      this.startPeriodicUpdateCheck();
      this.setupVisibilityChangeListener();
      this.checkCacheOnStartup();
    }
  }

  /**
   * Check cache status on startup and invalidate if needed
   */
  private async checkCacheOnStartup(): Promise<void> {
    try {
      const shouldInvalidate = await cacheInvalidationService.shouldInvalidateCache();
      
      if (shouldInvalidate) {
        console.log('[TWA Update] Cache invalidation needed on startup');
        
        toast.info('Updating app cache...', { duration: 3000 });
        
        const results = await cacheInvalidationService.invalidateAllCaches();
        const successCount = results.filter(r => r.success).length;
        
        console.log('[TWA Update] Cache invalidation results:', results);
        
        if (successCount >= results.length / 2) {
          toast.success('App cache updated successfully!');
        } else {
          console.warn('[TWA Update] Some cache invalidation strategies failed');
        }
      }
    } catch (error) {
      console.error('[TWA Update] Error checking cache on startup:', error);
    }
  }

  /**
   * Start periodic update checking with enhanced frequency
   */
  private startPeriodicUpdateCheck(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
    }

    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates();
    }, this.CHECK_INTERVAL);

    // Check immediately on startup after a short delay
    setTimeout(() => {
      this.checkForUpdates();
    }, 3000);
  }

  /**
   * Setup listener for when app becomes visible again
   */
  private setupVisibilityChangeListener(): void {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // App became visible, check for updates if it's been a while
        const timeSinceLastCheck = Date.now() - this.lastUpdateCheck;
        if (timeSinceLastCheck > this.CHECK_INTERVAL / 3) {
          console.log('[TWA Update] App became visible, checking for updates');
          this.checkForUpdates();
        }
      }
    });
  }

  /**
   * Enhanced update checking with aggressive cache busting
   */
  async checkForUpdates(): Promise<UpdateInfo> {
    try {
      this.lastUpdateCheck = Date.now();
      console.log('[TWA Update] Checking for updates with cache invalidation...');

      // Create multiple cache-busting URLs to ensure fresh fetch
      const cacheBustValue = Date.now();
      const randomValue = Math.random().toString(36).substring(7);
      
      const updateCheckUrls = [
        `${window.location.origin}/app/manifest.json?${this.CACHE_BUST_PARAM}=${cacheBustValue}&r=${randomValue}`,
        `${window.location.origin}/app/manifest.json?timestamp=${cacheBustValue}`,
        `${window.location.origin}/app/manifest.json?nocache=${Date.now()}`
      ];

      let manifestData = null;
      let successfulUrl = null;

      // Try multiple URLs to bypass any caching layers
      for (const url of updateCheckUrls) {
        try {
          console.log('[TWA Update] Trying URL:', url);
          
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
              'Pragma': 'no-cache',
              'Expires': '0',
              'If-None-Match': '*',
              'If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT'
            },
            cache: 'no-store'
          });

          if (response.ok) {
            manifestData = await response.json();
            successfulUrl = url;
            console.log('[TWA Update] Successfully fetched manifest from:', url);
            break;
          }
        } catch (error) {
          console.warn('[TWA Update] Failed to fetch from URL:', url, error);
          continue;
        }
      }

      if (manifestData && successfulUrl) {
        const serverVersion = manifestData.version || manifestData.short_name || '1.0.0';
        const cacheStatus = cacheInvalidationService.getCacheStatus();
        const localVersion = cacheStatus.manifestVersion || '1.0.0';

        console.log('[TWA Update] Version comparison:', { 
          serverVersion, 
          localVersion, 
          cacheStatus,
          fetchedFrom: successfulUrl 
        });

        if (this.isUpdateAvailable(serverVersion, localVersion)) {
          console.log('[TWA Update] Update detected! Server:', serverVersion, 'Local:', localVersion);
          
          const updateInfo: UpdateInfo = {
            available: true,
            version: serverVersion,
            timestamp: Date.now()
          };
          
          await this.handleUpdateAvailable(updateInfo);
          return updateInfo;
        } else {
          console.log('[TWA Update] No updates available');
        }
      } else {
        console.warn('[TWA Update] Failed to fetch manifest from all URLs');
      }
    } catch (error) {
      console.error('[TWA Update] Error checking for updates:', error);
    }

    return { available: false };
  }

  /**
   * Enhanced version comparison
   */
  private isUpdateAvailable(serverVersion: string, localVersion: string): boolean {
    if (!localVersion || localVersion === '1.0.0') {
      // If no local version or default version, consider update available
      return true;
    }
    
    // Simple version comparison - could be enhanced with semver
    const isVersionDifferent = serverVersion !== localVersion;
    
    // Also check if cache is stale (older than 30 minutes in TWA)
    const lastInvalidation = cacheInvalidationService.getCacheStatus().lastInvalidation;
    if (lastInvalidation) {
      const cacheAge = Date.now() - parseInt(lastInvalidation, 10);
      const thirtyMinutes = 30 * 60 * 1000;
      
      if (cacheAge > thirtyMinutes) {
        console.log('[TWA Update] Cache is stale, forcing update');
        return true;
      }
    }
    
    return isVersionDifferent;
  }

  /**
   * Handle when an update is available with comprehensive cache invalidation
   */
  private async handleUpdateAvailable(updateInfo: UpdateInfo): Promise<void> {
    console.log('[TWA Update] Handling available update with cache invalidation:', updateInfo);

    try {
      // Show update notification
      toast.info('App update found! Preparing...', { duration: 3000 });

      // Perform comprehensive cache invalidation
      const results = await cacheInvalidationService.invalidateAllCaches();
      const successCount = results.filter(r => r.success).length;
      
      console.log('[TWA Update] Cache invalidation results:', results);

      if (successCount >= results.length / 2) {
        // If most cache invalidation strategies succeeded
        toast.success('Update ready! Refreshing app...', { duration: 2500 });
        
        // Apply the update
        setTimeout(() => {
          this.applyUpdate(updateInfo);
        }, 3000);
      } else {
        // Fallback if cache invalidation mostly failed
        console.warn('[TWA Update] Cache invalidation partially failed, using fallback');
        toast.warning('Update available! Refreshing...', { duration: 2500 });
        
        setTimeout(() => {
          this.applyUpdateFallback();
        }, 3000);
      }
    } catch (error) {
      console.error('[TWA Update] Error handling update:', error);
      this.applyUpdateFallback();
    }
  }

  /**
   * Apply update with comprehensive cache busting
   */
  private async applyUpdate(updateInfo: UpdateInfo): Promise<void> {
    try {
      console.log('[TWA Update] Applying update with cache invalidation...');

      // Store new version before refresh
      if (updateInfo.version) {
        localStorage.setItem('manifest_version', updateInfo.version);
        localStorage.setItem('app_version', updateInfo.version);
      }

      // Perform hard refresh through cache invalidation service
      await cacheInvalidationService.performHardRefresh();
      
    } catch (error) {
      console.error('[TWA Update] Error applying update:', error);
      this.applyUpdateFallback();
    }
  }

  /**
   * Fallback update method
   */
  private applyUpdateFallback(): void {
    console.log('[TWA Update] Using fallback update method...');
    
    const cacheBustValue = Date.now();
    const currentUrl = new URL(window.location.href);
    
    // Add multiple cache busting parameters
    currentUrl.searchParams.set('v', cacheBustValue.toString());
    currentUrl.searchParams.set('cache_bust', '1');
    currentUrl.searchParams.set('force_refresh', cacheBustValue.toString());
    
    window.location.href = currentUrl.toString();
  }

  /**
   * Force an immediate update check with cache invalidation
   */
  async forceUpdateCheck(): Promise<UpdateInfo> {
    console.log('[TWA Update] Forcing update check with cache invalidation...');
    
    // First invalidate caches
    toast.info('Checking for updates...', { duration: 2000 });
    
    const results = await cacheInvalidationService.invalidateAllCaches();
    console.log('[TWA Update] Forced cache invalidation results:', results);
    
    // Then check for updates
    return await this.checkForUpdates();
  }

  /**
   * Get current update status
   */
  getUpdateStatus(): {
    lastCheck: number;
    cacheStatus: any;
    checkInterval: number;
  } {
    return {
      lastCheck: this.lastUpdateCheck,
      cacheStatus: cacheInvalidationService.getCacheStatus(),
      checkInterval: this.CHECK_INTERVAL
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }
}

export const twaUpdateService = new TWAUpdateService();
