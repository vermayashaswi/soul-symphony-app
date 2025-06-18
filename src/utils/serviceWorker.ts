
/**
 * PWABuilder-Optimized Service Worker Registration and Management
 */

export interface SwRegistrationResult {
  success: boolean;
  registration?: ServiceWorkerRegistration;
  error?: Error;
}

export interface SyncCapabilities {
  backgroundSync: boolean;
  pushNotifications: boolean;
  periodicSync: boolean;
}

interface ServiceWorkerRegistrationWithSync extends ServiceWorkerRegistration {
  sync?: {
    register(tag: string): Promise<void>;
  };
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private isRegistered = false;
  private updateListeners: Array<(available: boolean) => void> = [];

  /**
   * PWABuilder-optimized service worker registration
   */
  async register(): Promise<SwRegistrationResult> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[SW Manager] Service workers not supported');
      return { success: false, error: new Error('Service workers not supported') };
    }

    try {
      console.log('[SW Manager] PWABuilder: Registering service worker...');
      
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'imports' // PWABuilder friendly cache strategy
      });

      this.registration = registration;
      this.isRegistered = true;

      // Enhanced update handling for PWABuilder
      registration.addEventListener('updatefound', () => {
        console.log('[SW Manager] PWABuilder: Update found, installing new version...');
        this.handleUpdate(registration);
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', this.handleMessage.bind(this));

      // Listen for controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW Manager] PWABuilder: Service worker controller changed');
        this.notifyUpdateListeners(false);
      });

      console.log('[SW Manager] PWABuilder: Service worker registered successfully');
      
      // Delayed update check for PWABuilder compatibility
      setTimeout(() => {
        this.checkForUpdates();
      }, 3000);
      
      return { success: true, registration };
      
    } catch (error) {
      console.error('[SW Manager] PWABuilder: Service worker registration failed:', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * PWABuilder-friendly update checking
   */
  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) {
      console.warn('[SW Manager] PWABuilder: No registration available for update check');
      return false;
    }

    try {
      console.log('[SW Manager] PWABuilder: Checking for updates...');
      await this.registration.update();
      
      if (this.registration.waiting) {
        console.log('[SW Manager] PWABuilder: Update available (waiting service worker found)');
        this.notifyUpdateListeners(true);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[SW Manager] PWABuilder: Update check failed:', error);
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
        console.error('[SW Manager] PWABuilder: Update listener error:', error);
      }
    });
  }

  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return true;
    }

    try {
      const result = await this.registration.unregister();
      this.registration = null;
      this.isRegistered = false;
      this.updateListeners = [];
      console.log('[SW Manager] PWABuilder: Service worker unregistered');
      return result;
    } catch (error) {
      console.error('[SW Manager] PWABuilder: Failed to unregister service worker:', error);
      return false;
    }
  }

  isServiceWorkerRegistered(): boolean {
    return this.isRegistered && this.registration !== null;
  }

  getCapabilities(): SyncCapabilities {
    return {
      backgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
      pushNotifications: 'serviceWorker' in navigator && 'PushManager' in window,
      periodicSync: 'serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype
    };
  }

  async requestBackgroundSync(tag: string = 'pwa-builder-sync'): Promise<boolean> {
    if (!this.registration) {
      console.warn('[SW Manager] PWABuilder: No service worker registration available for background sync');
      return false;
    }

    const registrationWithSync = this.registration as ServiceWorkerRegistrationWithSync;
    
    if (!registrationWithSync.sync) {
      console.warn('[SW Manager] PWABuilder: Background sync not supported');
      return false;
    }

    try {
      await registrationWithSync.sync.register(tag);
      console.log('[SW Manager] PWABuilder: Background sync registered:', tag);
      return true;
    } catch (error) {
      console.error('[SW Manager] PWABuilder: Failed to register background sync:', error);
      return false;
    }
  }

  private handleUpdate(registration: ServiceWorkerRegistration) {
    const newWorker = registration.installing;
    if (!newWorker) return;

    const handleStateChange = () => {
      console.log('[SW Manager] PWABuilder: New service worker state:', newWorker.state);
      
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        console.log('[SW Manager] PWABuilder: New service worker installed and ready');
        newWorker.removeEventListener('statechange', handleStateChange);
        this.notifyUpdateListeners(true);
      } else if (newWorker.state === 'activated') {
        console.log('[SW Manager] PWABuilder: New service worker activated');
        this.notifyUpdateListeners(false);
      }
    };

    newWorker.addEventListener('statechange', handleStateChange);
  }

  private handleMessage(event: MessageEvent) {
    console.log('[SW Manager] PWABuilder: Message received from service worker:', event.data);
    
    const { type, version, message, pwaBuilder } = event.data;
    
    switch (type) {
      case 'SW_UPDATED':
        console.log('[SW Manager] PWABuilder: Service worker updated:', { version, message, pwaBuilder });
        this.notifyUpdateListeners(false);
        break;
        
      case 'UPDATE_AVAILABLE':
        console.log('[SW Manager] PWABuilder: Update available:', { version, message, pwaBuilder });
        this.notifyUpdateListeners(true);
        break;
        
      case 'SW_ACTIVATED':
        console.log('[SW Manager] PWABuilder: Service worker activated:', { version, message, pwaBuilder });
        break;
        
      default:
        console.log('[SW Manager] PWABuilder: Unknown message type:', type);
    }
  }

  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }

  async skipWaiting(): Promise<void> {
    if (!this.registration || !this.registration.waiting) {
      console.warn('[SW Manager] PWABuilder: No waiting service worker to skip');
      return;
    }

    console.log('[SW Manager] PWABuilder: Skipping waiting service worker');
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  async getVersionInfo(): Promise<any> {
    if (!this.registration || !this.registration.active) {
      return null;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };
      
      this.registration!.active!.postMessage(
        { type: 'GET_VERSION' }, 
        [messageChannel.port2]
      );
      
      setTimeout(() => resolve(null), 3000); // Shorter timeout for PWABuilder
    });
  }
}

// Export singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();

/**
 * PWABuilder-optimized service worker initialization
 */
export async function initializeServiceWorker(): Promise<SwRegistrationResult> {
  console.log('[SW Init] PWABuilder: Initializing service worker...');
  
  const result = await serviceWorkerManager.register();
  
  if (result.success) {
    console.log('[SW Init] PWABuilder: Service worker initialized successfully');
    
    // PWABuilder-friendly update check interval
    setInterval(() => {
      serviceWorkerManager.checkForUpdates();
    }, 180000); // Check every 3 minutes
    
  } else {
    console.error('[SW Init] PWABuilder: Service worker initialization failed:', result.error);
  }
  
  return result;
}

/**
 * Enhanced PWA detection for PWABuilder
 */
export function isPWA(): boolean {
  const standaloneQuery = window.matchMedia('(display-mode: standalone)');
  const fullscreenQuery = window.matchMedia('(display-mode: fullscreen)');
  const iOSStandalone = (window.navigator as any).standalone === true;
  
  // PWABuilder specific detection
  const userAgent = navigator.userAgent;
  const isPWABuilder = userAgent.includes('PWABuilder') || 
                      userAgent.includes('TWA') || 
                      userAgent.includes('WebAPK');
  
  return standaloneQuery.matches || fullscreenQuery.matches || iOSStandalone || isPWABuilder;
}

export function canInstallPWA(): boolean {
  return 'serviceWorker' in navigator && 
         ('BeforeInstallPromptEvent' in window || isPWA());
}

export function isWebView(): boolean {
  try {
    const userAgent = navigator.userAgent;
    return userAgent.includes('wv') || 
           userAgent.includes('WebView') || 
           userAgent.includes('PWABuilder') ||
           userAgent.includes('TWA') ||
           window.location.protocol === 'file:' ||
           (window as any).AndroidInterface !== undefined ||
           document.URL.indexOf('http://') === -1 && document.URL.indexOf('https://') === -1;
  } catch {
    return false;
  }
}
