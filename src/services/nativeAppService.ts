
import { toast } from 'sonner';

export interface NativeAppInfo {
  isNativeApp: boolean;
  isWebView: boolean;
  userAgent: string;
  platform: 'ios' | 'android' | 'web';
  version: string;
}

class NativeAppService {
  private appInfo: NativeAppInfo;
  private updateCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.appInfo = this.detectNativeApp();
    console.log('[NativeAppService] Initialized:', this.appInfo);
  }

  private detectNativeApp(): NativeAppInfo {
    const userAgent = navigator.userAgent;
    const isNativeApp = userAgent.includes('SouloNativeApp') || 
                       userAgent.includes('Capacitor') ||
                       window.location.protocol === 'capacitor:' ||
                       (window as any).Capacitor !== undefined;
    
    const isWebView = userAgent.includes('wv') || 
                     userAgent.includes('WebView') || 
                     window.location.protocol === 'file:' ||
                     (window as any).AndroidInterface !== undefined ||
                     document.URL.indexOf('http://') === -1 && document.URL.indexOf('https://') === -1;
    
    let platform: 'ios' | 'android' | 'web' = 'web';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      platform = 'ios';
    } else if (userAgent.includes('Android')) {
      platform = 'android';
    }

    return {
      isNativeApp,
      isWebView,
      userAgent,
      platform,
      version: '1.2.2'
    };
  }

  isNativeApp(): boolean {
    return this.appInfo.isNativeApp;
  }

  isWebView(): boolean {
    return this.appInfo.isWebView;
  }

  getPlatform(): 'ios' | 'android' | 'web' {
    return this.appInfo.platform;
  }

  getAppInfo(): NativeAppInfo {
    return { ...this.appInfo };
  }

  async clearNativeCache(): Promise<boolean> {
    try {
      console.log('[NativeAppService] Clearing native app cache...');
      
      // Clear all browser caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[NativeAppService] Cleared cache storages');
      }

      // Clear localStorage items
      const keysToKeep = ['feelosophy-theme', 'feelosophy-color-theme', 'sb-auth-token'];
      const allKeys = Object.keys(localStorage);
      
      allKeys.forEach(key => {
        if (!keysToKeep.some(keepKey => key.includes(keepKey))) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('[NativeAppService] Cleared localStorage (keeping auth)');

      // Clear sessionStorage
      sessionStorage.clear();
      console.log('[NativeAppService] Cleared sessionStorage');

      // Native-specific cache clearing
      if (this.isNativeApp() && (window as any).Capacitor) {
        try {
          // Try to clear WebView cache using Capacitor plugins
          const { Capacitor } = window as any;
          
          if (Capacitor.Plugins?.App) {
            console.log('[NativeAppService] Clearing WebView cache via Capacitor');
            // This will be handled by the native layer
          }
        } catch (error) {
          console.warn('[NativeAppService] Native cache clear failed:', error);
        }
      }

      return true;
    } catch (error) {
      console.error('[NativeAppService] Cache clearing failed:', error);
      return false;
    }
  }

  async forceAppRefresh(): Promise<void> {
    console.log('[NativeAppService] Forcing app refresh for native app');
    
    try {
      // Clear cache first
      await this.clearNativeCache();
      
      // Add cache-busting parameters
      const url = new URL(window.location.href);
      url.searchParams.set('_nativeRefresh', Date.now().toString());
      url.searchParams.set('_v', this.appInfo.version);
      url.searchParams.set('_clearCache', 'true');
      
      toast.info('Updating App...', {
        description: 'Refreshing to latest version',
        duration: 2000
      });
      
      setTimeout(() => {
        if (this.isNativeApp()) {
          // For native apps, use location.replace to ensure complete refresh
          window.location.replace(url.toString());
        } else {
          // For web, use standard reload
          window.location.href = url.toString();
        }
      }, 2000);
      
    } catch (error) {
      console.error('[NativeAppService] Force refresh failed:', error);
      
      // Fallback: simple reload
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }

  startNativeUpdateChecking(): void {
    if (!this.isNativeApp()) return;
    
    console.log('[NativeAppService] Starting native app update checking...');
    
    // Check for updates more frequently in native apps
    this.updateCheckInterval = setInterval(() => {
      this.checkForNativeUpdates();
    }, 15000); // Every 15 seconds for native apps
    
    // Also check when app becomes visible
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => {
          this.checkForNativeUpdates();
        }, 1000);
      }
    });
  }

  private async checkForNativeUpdates(): Promise<void> {
    if (!this.isNativeApp()) return;
    
    try {
      console.log('[NativeAppService] Checking for native app updates...');
      
      // Check if service worker has updates
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration) {
        await registration.update();
        
        if (registration.waiting) {
          console.log('[NativeAppService] Update available for native app');
          
          toast.info('App Update Available!', {
            description: 'Tap to update to the latest version',
            duration: 0, // Don't auto-dismiss
            action: {
              label: 'Update Now',
              onClick: () => this.forceAppRefresh()
            }
          });
        }
      }
      
    } catch (error) {
      console.error('[NativeAppService] Native update check failed:', error);
    }
  }

  stopNativeUpdateChecking(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }

  // Enhanced routing for native apps
  ensureAppRoute(): void {
    if (!this.isNativeApp()) return;
    
    const currentPath = window.location.pathname;
    
    // Ensure native app always starts at /app routes
    if (currentPath === '/' || !currentPath.startsWith('/app')) {
      console.log('[NativeAppService] Redirecting native app to /app route');
      
      const newUrl = '/app' + (currentPath === '/' ? '/home' : currentPath);
      window.history.replaceState(null, '', newUrl);
    }
  }
}

export const nativeAppService = new NativeAppService();
