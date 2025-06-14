
/**
 * PWA Service for SOULo
 * Handles PWA-specific functionality including installation, updates, and offline support
 */

export interface PWAInfo {
  isInstalled: boolean;
  isInstallable: boolean;
  isStandalone: boolean;
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
}

export class PWAService {
  private static instance: PWAService;
  private deferredPrompt: any = null;
  private installEventHandlers: ((event: any) => void)[] = [];
  private updateEventHandlers: (() => void)[] = [];

  static getInstance(): PWAService {
    if (!PWAService.instance) {
      PWAService.instance = new PWAService();
    }
    return PWAService.instance;
  }

  constructor() {
    this.initializeEventListeners();
  }

  private initializeEventListeners(): void {
    // Listen for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.notifyInstallEventHandlers(e);
    });

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App was installed');
      this.deferredPrompt = null;
    });

    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] New service worker activated');
        this.notifyUpdateEventHandlers();
      });
    }
  }

  /**
   * Get current PWA information
   */
  getPWAInfo(): PWAInfo {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone === true;
    
    const platform = this.detectPlatform();
    const isInstallable = !!this.deferredPrompt;
    const isInstalled = isStandalone;

    return {
      isInstalled,
      isInstallable,
      isStandalone,
      platform
    };
  }

  /**
   * Detect the current platform
   */
  private detectPlatform(): 'ios' | 'android' | 'desktop' | 'unknown' {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/iphone|ipad|ipod/.test(userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      return 'ios';
    }
    
    if (/android/.test(userAgent)) {
      return 'android';
    }
    
    if (/windows|mac|linux/.test(userAgent)) {
      return 'desktop';
    }
    
    return 'unknown';
  }

  /**
   * Trigger PWA installation
   */
  async installPWA(): Promise<boolean> {
    if (!this.deferredPrompt) {
      console.warn('[PWA] No install prompt available');
      return false;
    }

    try {
      await this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt');
        return true;
      } else {
        console.log('[PWA] User dismissed the install prompt');
        return false;
      }
    } catch (error) {
      console.error('[PWA] Error during installation:', error);
      return false;
    } finally {
      this.deferredPrompt = null;
    }
  }

  /**
   * Check if app is running in PWA mode
   */
  isRunningAsPWA(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }

  /**
   * Register for install events
   */
  onInstallAvailable(handler: (event: any) => void): void {
    this.installEventHandlers.push(handler);
  }

  /**
   * Register for update events
   */
  onUpdateAvailable(handler: () => void): void {
    this.updateEventHandlers.push(handler);
  }

  /**
   * Notify install event handlers
   */
  private notifyInstallEventHandlers(event: any): void {
    this.installEventHandlers.forEach(handler => handler(event));
  }

  /**
   * Notify update event handlers
   */
  private notifyUpdateEventHandlers(): void {
    this.updateEventHandlers.forEach(handler => handler());
  }

  /**
   * Force service worker update
   */
  async updateServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      await registration.update();
    }
  }

  /**
   * Clear app cache
   */
  async clearCache(): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('[PWA] Cache cleared');
    }
  }

  /**
   * Get app cache size
   */
  async getCacheSize(): Promise<number> {
    if (!('caches' in window)) return 0;

    try {
      const cacheNames = await caches.keys();
      let totalSize = 0;

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        
        for (const request of requests) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }
      }

      return totalSize;
    } catch (error) {
      console.error('[PWA] Error calculating cache size:', error);
      return 0;
    }
  }

  /**
   * Check network status
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Register network status change handlers
   */
  onNetworkChange(onOnline: () => void, onOffline: () => void): void {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
  }
}

// Export singleton instance
export const pwaService = PWAService.getInstance();
