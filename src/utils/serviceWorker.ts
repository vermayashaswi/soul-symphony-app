
/**
 * Deployment-Optimized Service Worker Management
 */

export interface SwRegistrationResult {
  success: boolean;
  registration?: ServiceWorkerRegistration;
  error?: Error;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private isRegistered = false;
  private updateListeners: Array<(available: boolean) => void> = [];

  async register(): Promise<SwRegistrationResult> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[SW Manager] Service workers not supported');
      return { success: false, error: new Error('Service workers not supported') };
    }

    try {
      console.log('[SW Manager] Registering service worker for deployment...');
      
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none' // Always check for updates
      });

      this.registration = registration;
      this.isRegistered = true;

      // Force immediate update check
      registration.addEventListener('updatefound', () => {
        console.log('[SW Manager] Update found, installing new version...');
        this.handleUpdate(registration);
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', this.handleMessage.bind(this));

      // Listen for controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW Manager] Service worker controller changed - reloading page');
        window.location.reload();
      });

      console.log('[SW Manager] Service worker registered successfully');
      
      // Immediate update check
      await this.checkForUpdates();
      
      return { success: true, registration };
      
    } catch (error) {
      console.error('[SW Manager] Service worker registration failed:', error);
      return { success: false, error: error as Error };
    }
  }

  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) {
      console.warn('[SW Manager] No registration available for update check');
      return false;
    }

    try {
      console.log('[SW Manager] Checking for updates...');
      await this.registration.update();
      
      if (this.registration.waiting) {
        console.log('[SW Manager] Update available (waiting service worker found)');
        this.notifyUpdateListeners(true);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[SW Manager] Update check failed:', error);
      return false;
    }
  }

  addUpdateListener(callback: (available: boolean) => void): void {
    this.updateListeners.push(callback);
  }

  removeUpdateListener(callback: (available: boolean) => void): void {
    this.updateListeners = this.updateListeners.filter(listener => listener !== callback);
  }

  private notifyUpdateListeners(available: boolean): void {
    this.updateListeners.forEach(listener => {
      try {
        listener(available);
      } catch (error) {
        console.error('[SW Manager] Update listener error:', error);
      }
    });
  }

  async clearAllCaches(): Promise<boolean> {
    try {
      console.log('[SW Manager] Clearing all caches...');
      
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[SW Manager] All caches cleared');
      }

      // Also clear localStorage except essential items
      const keysToKeep = ['sb-auth-token'];
      const allKeys = Object.keys(localStorage);
      
      allKeys.forEach(key => {
        if (!keysToKeep.some(keepKey => key.includes(keepKey))) {
          localStorage.removeItem(key);
        }
      });
      
      sessionStorage.clear();
      console.log('[SW Manager] Storage cleared');

      return true;
    } catch (error) {
      console.error('[SW Manager] Cache clearing failed:', error);
      return false;
    }
  }

  async forceRefresh(): Promise<void> {
    console.log('[SW Manager] Forcing app refresh');
    
    try {
      await this.clearAllCaches();
      
      // Add cache busting parameters
      const url = new URL(window.location.href);
      url.searchParams.set('_refresh', Date.now().toString());
      url.searchParams.set('_v', '2.0.0');
      
      window.location.href = url.toString();
      
    } catch (error) {
      console.error('[SW Manager] Force refresh failed:', error);
      window.location.reload();
    }
  }

  async skipWaiting(): Promise<void> {
    if (!this.registration || !this.registration.waiting) {
      console.warn('[SW Manager] No waiting service worker to skip');
      return;
    }

    console.log('[SW Manager] Skipping waiting service worker');
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  private handleUpdate(registration: ServiceWorkerRegistration) {
    const newWorker = registration.installing;
    if (!newWorker) return;

    const handleStateChange = () => {
      console.log('[SW Manager] New service worker state:', newWorker.state);
      
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        console.log('[SW Manager] New service worker installed and ready');
        newWorker.removeEventListener('statechange', handleStateChange);
        this.notifyUpdateListeners(true);
      }
    };

    newWorker.addEventListener('statechange', handleStateChange);
  }

  private handleMessage(event: MessageEvent) {
    console.log('[SW Manager] Message received from service worker:', event.data);
    
    const { type, version } = event.data;
    
    switch (type) {
      case 'SW_ACTIVATED':
        console.log('[SW Manager] Service worker activated:', version);
        break;
        
      default:
        console.log('[SW Manager] Unknown message type:', type);
    }
  }

  isServiceWorkerRegistered(): boolean {
    return this.isRegistered && this.registration !== null;
  }

  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }
}

// Export singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();

export async function initializeServiceWorker(): Promise<SwRegistrationResult> {
  console.log('[SW Init] Initializing deployment-optimized service worker...');
  
  const result = await serviceWorkerManager.register();
  
  if (result.success) {
    console.log('[SW Init] Service worker initialized successfully');
    
    // Check for updates every 30 seconds in production
    setInterval(() => {
      serviceWorkerManager.checkForUpdates();
    }, 30000);
    
  } else {
    console.error('[SW Init] Service worker initialization failed:', result.error);
  }
  
  return result;
}

export function isPWA(): boolean {
  const standaloneQuery = window.matchMedia('(display-mode: standalone)');
  const fullscreenQuery = window.matchMedia('(display-mode: fullscreen)');
  const iOSStandalone = (window.navigator as any).standalone === true;
  
  return standaloneQuery.matches || fullscreenQuery.matches || iOSStandalone;
}

export function isWebView(): boolean {
  try {
    const userAgent = navigator.userAgent;
    return userAgent.includes('wv') || 
           userAgent.includes('WebView') || 
           window.location.protocol === 'file:' ||
           (window as any).AndroidInterface !== undefined;
  } catch {
    return false;
  }
}
