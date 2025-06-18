
/**
 * Enhanced Service Worker Registration and Management
 * Compatible with PWABuilder and provides better update detection
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

// Extend ServiceWorkerRegistration type to include sync property
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
   * Enhanced service worker registration with better error handling
   */
  async register(): Promise<SwRegistrationResult> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[SW Manager] Service workers not supported');
      return { success: false, error: new Error('Service workers not supported') };
    }

    try {
      console.log('[SW Manager] Registering service worker...');
      
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none' // Always check for updates
      });

      this.registration = registration;
      this.isRegistered = true;

      // Enhanced update handling
      registration.addEventListener('updatefound', () => {
        console.log('[SW Manager] Update found, installing new version...');
        this.handleUpdate(registration);
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', this.handleMessage.bind(this));

      // Listen for controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW Manager] Service worker controller changed');
        this.notifyUpdateListeners(false); // Update applied
      });

      console.log('[SW Manager] Service worker registered successfully');
      
      // Initial update check
      setTimeout(() => {
        this.checkForUpdates();
      }, 2000);
      
      return { success: true, registration };
      
    } catch (error) {
      console.error('[SW Manager] Service worker registration failed:', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Check for service worker updates
   */
  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) {
      console.warn('[SW Manager] No registration available for update check');
      return false;
    }

    try {
      console.log('[SW Manager] Checking for updates...');
      await this.registration.update();
      
      // Check if there's a waiting service worker
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

  /**
   * Add listener for update notifications
   */
  addUpdateListener(callback: (available: boolean) => void): void {
    this.updateListeners.push(callback);
  }

  /**
   * Remove update listener
   */
  removeUpdateListener(callback: (available: boolean) => void): void {
    this.updateListeners = this.updateListeners.filter(listener => listener !== callback);
  }

  /**
   * Notify all update listeners
   */
  private notifyUpdateListeners(available: boolean): void {
    this.updateListeners.forEach(listener => {
      try {
        listener(available);
      } catch (error) {
        console.error('[SW Manager] Update listener error:', error);
      }
    });
  }

  /**
   * Unregister the service worker
   */
  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return true;
    }

    try {
      const result = await this.registration.unregister();
      this.registration = null;
      this.isRegistered = false;
      this.updateListeners = [];
      console.log('[SW Manager] Service worker unregistered');
      return result;
    } catch (error) {
      console.error('[SW Manager] Failed to unregister service worker:', error);
      return false;
    }
  }

  /**
   * Check if service worker is registered
   */
  isServiceWorkerRegistered(): boolean {
    return this.isRegistered && this.registration !== null;
  }

  /**
   * Get enhanced service worker capabilities
   */
  getCapabilities(): SyncCapabilities {
    return {
      backgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
      pushNotifications: 'serviceWorker' in navigator && 'PushManager' in window,
      periodicSync: 'serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype
    };
  }

  /**
   * Enhanced background sync request
   */
  async requestBackgroundSync(tag: string = 'app-update-check'): Promise<boolean> {
    if (!this.registration) {
      console.warn('[SW Manager] No service worker registration available for background sync');
      return false;
    }

    const registrationWithSync = this.registration as ServiceWorkerRegistrationWithSync;
    
    if (!registrationWithSync.sync) {
      console.warn('[SW Manager] Background sync not supported');
      return false;
    }

    try {
      await registrationWithSync.sync.register(tag);
      console.log('[SW Manager] Background sync registered:', tag);
      return true;
    } catch (error) {
      console.error('[SW Manager] Failed to register background sync:', error);
      return false;
    }
  }

  /**
   * Enhanced update handling with better notifications
   */
  private handleUpdate(registration: ServiceWorkerRegistration) {
    const newWorker = registration.installing;
    if (!newWorker) return;

    const handleStateChange = () => {
      console.log('[SW Manager] New service worker state:', newWorker.state);
      
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        console.log('[SW Manager] New service worker installed and ready');
        newWorker.removeEventListener('statechange', handleStateChange);
        this.notifyUpdateListeners(true);
      } else if (newWorker.state === 'activated') {
        console.log('[SW Manager] New service worker activated');
        this.notifyUpdateListeners(false);
      }
    };

    newWorker.addEventListener('statechange', handleStateChange);
  }

  /**
   * Enhanced message handling from service worker
   */
  private handleMessage(event: MessageEvent) {
    console.log('[SW Manager] Message received from service worker:', event.data);
    
    const { type, version, message } = event.data;
    
    switch (type) {
      case 'SW_UPDATED':
        console.log('[SW Manager] Service worker updated:', { version, message });
        this.notifyUpdateListeners(false);
        break;
        
      case 'UPDATE_AVAILABLE':
        console.log('[SW Manager] Update available:', { version, message });
        this.notifyUpdateListeners(true);
        break;
        
      case 'SW_ACTIVATED':
        console.log('[SW Manager] Service worker activated:', { version, message });
        break;
        
      default:
        console.log('[SW Manager] Unknown message type:', type);
    }
  }

  /**
   * Get the current registration
   */
  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }

  /**
   * Enhanced skip waiting with better control
   */
  async skipWaiting(): Promise<void> {
    if (!this.registration || !this.registration.waiting) {
      console.warn('[SW Manager] No waiting service worker to skip');
      return;
    }

    console.log('[SW Manager] Skipping waiting service worker');
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  /**
   * Get current service worker version info
   */
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
      
      // Timeout after 5 seconds
      setTimeout(() => resolve(null), 5000);
    });
  }
}

// Export singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();

/**
 * Enhanced service worker initialization
 */
export async function initializeServiceWorker(): Promise<SwRegistrationResult> {
  // Register in all environments for PWA functionality
  console.log('[SW Init] Initializing service worker...');
  
  const result = await serviceWorkerManager.register();
  
  if (result.success) {
    console.log('[SW Init] Service worker initialized successfully');
    
    // Set up periodic update checks
    setInterval(() => {
      serviceWorkerManager.checkForUpdates();
    }, 300000); // Check every 5 minutes
    
  } else {
    console.error('[SW Init] Service worker initialization failed:', result.error);
  }
  
  return result;
}

/**
 * Enhanced PWA detection
 */
export function isPWA(): boolean {
  const standaloneQuery = window.matchMedia('(display-mode: standalone)');
  const fullscreenQuery = window.matchMedia('(display-mode: fullscreen)');
  const iOSStandalone = (window.navigator as any).standalone === true;
  
  return standaloneQuery.matches || fullscreenQuery.matches || iOSStandalone;
}

/**
 * Enhanced PWA installation capability check
 */
export function canInstallPWA(): boolean {
  return 'serviceWorker' in navigator && 
         ('BeforeInstallPromptEvent' in window || isPWA());
}

/**
 * WebView detection for PWABuilder apps
 */
export function isWebView(): boolean {
  try {
    const userAgent = navigator.userAgent;
    return userAgent.includes('wv') || 
           userAgent.includes('WebView') || 
           window.location.protocol === 'file:' ||
           (window as any).AndroidInterface !== undefined ||
           document.URL.indexOf('http://') === -1 && document.URL.indexOf('https://') === -1;
  } catch {
    return false;
  }
}
