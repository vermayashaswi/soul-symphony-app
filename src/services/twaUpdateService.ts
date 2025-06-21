
import { detectTWAEnvironment } from '@/utils/twaDetection';
import { toast } from 'sonner';

export interface UpdateInfo {
  available: boolean;
  version?: string;
  timestamp?: number;
}

class TWAUpdateService {
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private lastUpdateCheck: number = 0;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly CACHE_BUST_PARAM = 'v';

  /**
   * Initialize update checking for TWA environment
   */
  init(): void {
    const twaEnv = detectTWAEnvironment();
    
    if (twaEnv.isTWA || twaEnv.isStandalone) {
      console.log('[TWA Update] Initializing update service for TWA environment');
      this.startPeriodicUpdateCheck();
      this.setupVisibilityChangeListener();
    }
  }

  /**
   * Start periodic update checking
   */
  private startPeriodicUpdateCheck(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
    }

    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates();
    }, this.CHECK_INTERVAL);

    // Check immediately on startup
    setTimeout(() => {
      this.checkForUpdates();
    }, 2000);
  }

  /**
   * Setup listener for when app becomes visible again
   */
  private setupVisibilityChangeListener(): void {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // App became visible, check for updates if it's been a while
        const timeSinceLastCheck = Date.now() - this.lastUpdateCheck;
        if (timeSinceLastCheck > this.CHECK_INTERVAL / 2) {
          console.log('[TWA Update] App became visible, checking for updates');
          this.checkForUpdates();
        }
      }
    });
  }

  /**
   * Check for available updates
   */
  async checkForUpdates(): Promise<UpdateInfo> {
    try {
      this.lastUpdateCheck = Date.now();
      console.log('[TWA Update] Checking for updates...');

      // Create cache-busting URL
      const cacheBustValue = Date.now();
      const updateCheckUrl = `${window.location.origin}/app/manifest.json?${this.CACHE_BUST_PARAM}=${cacheBustValue}`;

      const response = await fetch(updateCheckUrl, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });

      if (response.ok) {
        const manifestData = await response.json();
        const serverVersion = manifestData.version || manifestData.short_name || 'unknown';
        const localVersion = this.getLocalVersion();

        console.log('[TWA Update] Version check:', { serverVersion, localVersion });

        if (this.isUpdateAvailable(serverVersion, localVersion)) {
          console.log('[TWA Update] Update available!');
          const updateInfo: UpdateInfo = {
            available: true,
            version: serverVersion,
            timestamp: Date.now()
          };
          
          this.handleUpdateAvailable(updateInfo);
          return updateInfo;
        } else {
          console.log('[TWA Update] No updates available');
        }
      } else {
        console.warn('[TWA Update] Failed to check for updates:', response.status);
      }
    } catch (error) {
      console.error('[TWA Update] Error checking for updates:', error);
    }

    return { available: false };
  }

  /**
   * Get the locally stored version
   */
  private getLocalVersion(): string {
    return localStorage.getItem('app_version') || '1.0.0';
  }

  /**
   * Check if an update is available
   */
  private isUpdateAvailable(serverVersion: string, localVersion: string): boolean {
    // Simple version comparison - in a real app you might want semver
    return serverVersion !== localVersion;
  }

  /**
   * Handle when an update is available
   */
  private handleUpdateAvailable(updateInfo: UpdateInfo): void {
    console.log('[TWA Update] Handling available update:', updateInfo);

    // Store the new version
    if (updateInfo.version) {
      localStorage.setItem('app_version', updateInfo.version);
    }

    // Show update notification to user
    this.showUpdateNotification();

    // Trigger cache clearing and reload
    setTimeout(() => {
      this.applyUpdate();
    }, 3000); // Give user time to see the notification
  }

  /**
   * Show update notification to user
   */
  private showUpdateNotification(): void {
    toast.success('App update available! Refreshing...', {
      duration: 2500,
    });
  }

  /**
   * Apply the update by clearing caches and reloading
   */
  async applyUpdate(): Promise<void> {
    try {
      console.log('[TWA Update] Applying update...');

      // Clear all caches
      await this.clearAllCaches();

      // Force reload with cache bust
      const cacheBustValue = Date.now();
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set(this.CACHE_BUST_PARAM, cacheBustValue.toString());
      
      window.location.href = currentUrl.toString();
    } catch (error) {
      console.error('[TWA Update] Error applying update:', error);
      // Fallback to simple reload
      window.location.reload();
    }
  }

  /**
   * Clear all browser caches
   */
  private async clearAllCaches(): Promise<void> {
    try {
      // Clear service worker caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => {
            console.log('[TWA Update] Clearing cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }

      // Clear localStorage (except essential data)
      const essentialKeys = ['app_version', 'user_preferences'];
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !essentialKeys.includes(key)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));

      console.log('[TWA Update] Caches cleared successfully');
    } catch (error) {
      console.error('[TWA Update] Error clearing caches:', error);
    }
  }

  /**
   * Force an immediate update check
   */
  async forceUpdateCheck(): Promise<UpdateInfo> {
    console.log('[TWA Update] Forcing update check...');
    return await this.checkForUpdates();
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
