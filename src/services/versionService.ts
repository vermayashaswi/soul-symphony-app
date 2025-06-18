
/**
 * Version Management Service
 * Handles app version checking and update notifications
 */

export interface AppVersion {
  version: string;
  timestamp: number;
  forceUpdate: boolean;
  features: string[];
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  forceUpdate: boolean;
  changelog?: string[];
}

class VersionService {
  private currentVersion = '1.2.0';
  private lastUpdateCheck = 0;
  private updateCheckInterval = 5 * 60 * 1000; // 5 minutes

  /**
   * Check if app update is available
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    const now = Date.now();
    
    // Throttle update checks
    if (now - this.lastUpdateCheck < this.updateCheckInterval) {
      return {
        updateAvailable: false,
        currentVersion: this.currentVersion,
        latestVersion: this.currentVersion,
        forceUpdate: false
      };
    }

    this.lastUpdateCheck = now;

    try {
      // Check service worker version
      const swVersion = await this.getServiceWorkerVersion();
      
      // Check if there's a version mismatch
      const updateAvailable = swVersion !== this.currentVersion;
      
      return {
        updateAvailable,
        currentVersion: this.currentVersion,
        latestVersion: swVersion || this.currentVersion,
        forceUpdate: updateAvailable,
        changelog: updateAvailable ? [
          'Enhanced feature flag system',
          'Improved caching for native apps',
          'Better offline support',
          'Real-time feature updates'
        ] : undefined
      };
    } catch (error) {
      console.error('[VersionService] Update check failed:', error);
      return {
        updateAvailable: false,
        currentVersion: this.currentVersion,
        latestVersion: this.currentVersion,
        forceUpdate: false
      };
    }
  }

  /**
   * Get service worker version
   */
  private async getServiceWorkerVersion(): Promise<string | null> {
    if (!('serviceWorker' in navigator)) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active) {
        return null;
      }

      return new Promise((resolve) => {
        const messageChannel = new MessageChannel();
        
        messageChannel.port1.onmessage = (event) => {
          if (event.data.type === 'VERSION_RESPONSE') {
            resolve(event.data.version);
          } else {
            resolve(null);
          }
        };

        registration.active.postMessage(
          { type: 'GET_VERSION' },
          [messageChannel.port2]
        );

        // Timeout after 5 seconds
        setTimeout(() => resolve(null), 5000);
      });
    } catch (error) {
      console.error('[VersionService] Error getting SW version:', error);
      return null;
    }
  }

  /**
   * Force app reload/update
   */
  async forceUpdate(): Promise<void> {
    try {
      // Clear all caches first
      await this.clearAppCache();
      
      // Reload the page
      window.location.reload();
    } catch (error) {
      console.error('[VersionService] Force update failed:', error);
      // Fallback: just reload
      window.location.reload();
    }
  }

  /**
   * Clear app cache
   */
  private async clearAppCache(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active) {
        return;
      }

      return new Promise((resolve) => {
        const messageChannel = new MessageChannel();
        
        messageChannel.port1.onmessage = (event) => {
          if (event.data.type === 'CACHE_CLEARED') {
            resolve();
          }
        };

        registration.active.postMessage(
          { type: 'CLEAR_CACHE' },
          [messageChannel.port2]
        );

        // Timeout after 10 seconds
        setTimeout(() => resolve(), 10000);
      });
    } catch (error) {
      console.error('[VersionService] Error clearing cache:', error);
    }
  }

  /**
   * Get current app version
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * Check if running in PWA mode
   */
  isPWAMode(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.matchMedia('(display-mode: fullscreen)').matches ||
           (window.navigator as any).standalone === true;
  }

  /**
   * Detect if running in PWABuilder native app
   */
  isPWABuilderApp(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroidWebView = userAgent.includes('wv') && userAgent.includes('android');
    const isWindowsWebView = userAgent.includes('webview') || userAgent.includes('edge');
    
    // Check for PWABuilder specific indicators
    const hasPWABuilderIndicators = 
      'pwabuilder' in window ||
      userAgent.includes('pwabuilder') ||
      (isAndroidWebView && this.isPWAMode()) ||
      (isWindowsWebView && this.isPWAMode());

    return hasPWABuilderIndicators;
  }
}

// Export singleton instance
export const versionService = new VersionService();
