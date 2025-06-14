/**
 * Enhanced PWA Service for SOULo - Mobile App & Native Wrapper Optimized
 * Handles PWA-specific functionality including installation, updates, offline support,
 * and native app wrapper detection for webtinative.xyz compatibility
 */

export interface PWAInfo {
  isInstalled: boolean;
  isInstallable: boolean;
  isStandalone: boolean;
  isNativeWrapper: boolean;
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
  capabilities: {
    hasNotifications: boolean;
    hasGeolocation: boolean;
    hasCamera: boolean;
    hasMicrophone: boolean;
    hasOfflineStorage: boolean;
  };
}

export class PWAService {
  private static instance: PWAService;
  private deferredPrompt: any = null;
  private installEventHandlers: ((event: any) => void)[] = [];
  private updateEventHandlers: (() => void)[] = [];
  private nativeWrapperDetected: boolean = false;

  static getInstance(): PWAService {
    if (!PWAService.instance) {
      PWAService.instance = new PWAService();
    }
    return PWAService.instance;
  }

  constructor() {
    this.initializeEventListeners();
    this.detectNativeWrapper();
    this.optimizeForMobile();
  }

  private initializeEventListeners(): void {
    // Listen for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.notifyInstallEventHandlers(e);
      console.log('[PWA] Install prompt available');
    });

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App was installed successfully');
      this.deferredPrompt = null;
      this.logInstallEvent();
    });

    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] New service worker activated');
        this.notifyUpdateEventHandlers();
      });
    }

    // Listen for network changes
    window.addEventListener('online', () => {
      console.log('[PWA] Network restored');
      this.syncOfflineData();
    });

    window.addEventListener('offline', () => {
      console.log('[PWA] Network lost - switching to offline mode');
    });
  }

  /**
   * Detect if running in a native wrapper (React Native WebView)
   */
  private detectNativeWrapper(): void {
    const userAgent = navigator.userAgent.toLowerCase();
    const hasWebView = userAgent.includes('wv') || 
                      userAgent.includes('webview') ||
                      window.ReactNativeWebView !== undefined ||
                      window.webkit?.messageHandlers !== undefined;
    
    this.nativeWrapperDetected = hasWebView;
    
    if (this.nativeWrapperDetected) {
      console.log('[PWA] Native wrapper detected - optimizing for native app');
      this.enableNativeOptimizations();
    }
  }

  /**
   * Enable native app optimizations
   */
  private enableNativeOptimizations(): void {
    // Disable context menu for native app feel
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Optimize touch interactions
    document.body.style.touchAction = 'manipulation';
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    
    // Add safe area support
    document.documentElement.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top)');
    document.documentElement.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom)');
    document.documentElement.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left)');
    document.documentElement.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right)');
  }

  /**
   * Mobile-specific optimizations
   */
  private optimizeForMobile(): void {
    // Disable bounce scrolling on iOS
    document.body.style.overscrollBehavior = 'none';
    
    // Optimize viewport for mobile
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
      );
    }

    // Preload critical assets for faster startup
    this.preloadCriticalAssets();
  }

  /**
   * Preload critical assets for mobile performance
   */
  private preloadCriticalAssets(): void {
    const criticalAssets = [
      '/icons/icon-192x192.png',
      '/icons/icon-512x512.png'
    ];

    criticalAssets.forEach(asset => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = asset;
      document.head.appendChild(link);
    });
  }

  /**
   * Get enhanced PWA information with native capabilities
   */
  getPWAInfo(): PWAInfo {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone === true;
    
    const platform = this.detectPlatform();
    const isInstallable = !!this.deferredPrompt && !this.nativeWrapperDetected;
    const isInstalled = isStandalone || this.nativeWrapperDetected;

    const capabilities = this.detectCapabilities();

    return {
      isInstalled,
      isInstallable,
      isStandalone,
      isNativeWrapper: this.nativeWrapperDetected,
      platform,
      capabilities
    };
  }

  /**
   * Detect device capabilities
   */
  private detectCapabilities() {
    return {
      hasNotifications: 'Notification' in window,
      hasGeolocation: 'geolocation' in navigator,
      hasCamera: 'getUserMedia' in navigator.mediaDevices,
      hasMicrophone: 'getUserMedia' in navigator.mediaDevices,
      hasOfflineStorage: 'caches' in window && 'indexedDB' in window
    };
  }

  /**
   * Enhanced platform detection
   */
  private detectPlatform(): 'ios' | 'android' | 'desktop' | 'unknown' {
    const userAgent = navigator.userAgent.toLowerCase();
    
    // iOS detection (including iPad on iOS 13+)
    if (/iphone|ipad|ipod/.test(userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      return 'ios';
    }
    
    // Android detection
    if (/android/.test(userAgent)) {
      return 'android';
    }
    
    // Desktop detection
    if (/windows|mac|linux/.test(userAgent) && navigator.maxTouchPoints === 0) {
      return 'desktop';
    }
    
    return 'unknown';
  }

  /**
   * Trigger PWA installation
   */
  async installPWA(): Promise<boolean> {
    if (this.nativeWrapperDetected) {
      console.log('[PWA] Already running in native wrapper');
      return true;
    }

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
           (window.navigator as any).standalone === true ||
           this.nativeWrapperDetected;
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

  /**
   * Sync offline data when network is restored
   */
  private async syncOfflineData(): Promise<void> {
    if (!this.isOnline()) return;
    
    try {
      // Implement offline data sync logic here
      console.log('[PWA] Syncing offline data...');
      
      // Trigger app-specific sync events
      window.dispatchEvent(new CustomEvent('pwa:sync-offline-data'));
    } catch (error) {
      console.error('[PWA] Error syncing offline data:', error);
    }
  }

  /**
   * Log installation event for analytics
   */
  private logInstallEvent(): void {
    const platform = this.detectPlatform();
    console.log(`[PWA] App installed on ${platform}`);
    
    // Send to analytics if available
    if (typeof gtag !== 'undefined') {
      gtag('event', 'pwa_install', {
        platform,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Export singleton instance
export const pwaService = PWAService.getInstance();
