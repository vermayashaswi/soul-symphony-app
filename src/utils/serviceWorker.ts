
/**
 * Service Worker Registration and Management
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

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private isRegistered = false;

  /**
   * Register the service worker
   */
  async register(): Promise<SwRegistrationResult> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[SW] Service workers not supported');
      return { success: false, error: new Error('Service workers not supported') };
    }

    try {
      console.log('[SW] Registering service worker...');
      
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      this.registration = registration;
      this.isRegistered = true;

      // Handle updates
      registration.addEventListener('updatefound', () => {
        console.log('[SW] Update found, installing new version...');
        this.handleUpdate(registration);
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', this.handleMessage.bind(this));

      console.log('[SW] Service worker registered successfully');
      
      return { success: true, registration };
      
    } catch (error) {
      console.error('[SW] Service worker registration failed:', error);
      return { success: false, error: error as Error };
    }
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
      console.log('[SW] Service worker unregistered');
      return result;
    } catch (error) {
      console.error('[SW] Failed to unregister service worker:', error);
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
   * Get service worker capabilities
   */
  getCapabilities(): SyncCapabilities {
    return {
      backgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
      pushNotifications: 'serviceWorker' in navigator && 'PushManager' in window,
      periodicSync: 'serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype
    };
  }

  /**
   * Request background sync for journal entries
   */
  async requestBackgroundSync(tag: string = 'journal-entry-sync'): Promise<boolean> {
    if (!this.registration || !('sync' in window.ServiceWorkerRegistration.prototype)) {
      console.warn('[SW] Background sync not supported');
      return false;
    }

    try {
      await this.registration.sync.register(tag);
      console.log('[SW] Background sync registered:', tag);
      return true;
    } catch (error) {
      console.error('[SW] Failed to register background sync:', error);
      return false;
    }
  }

  /**
   * Handle service worker updates
   */
  private handleUpdate(registration: ServiceWorkerRegistration) {
    const newWorker = registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // New content is available
        this.notifyUpdate();
      }
    });
  }

  /**
   * Handle messages from service worker
   */
  private handleMessage(event: MessageEvent) {
    console.log('[SW] Message received from service worker:', event.data);
    
    if (event.data.type === 'JOURNAL_SYNC_STATUS') {
      this.handleJournalSyncStatus(event.data.payload);
    }
  }

  /**
   * Handle journal sync status updates
   */
  private handleJournalSyncStatus(payload: any) {
    const { entry, status } = payload;
    
    if (status === 'success') {
      // Dispatch custom event for app to handle
      window.dispatchEvent(new CustomEvent('journalSyncSuccess', {
        detail: { entry }
      }));
    }
  }

  /**
   * Notify about service worker updates
   */
  private notifyUpdate() {
    // Dispatch custom event for app to handle
    window.dispatchEvent(new CustomEvent('swUpdateAvailable'));
  }

  /**
   * Get the current registration
   */
  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }

  /**
   * Skip waiting and activate new service worker
   */
  async skipWaiting(): Promise<void> {
    if (!this.registration || !this.registration.waiting) {
      return;
    }

    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

// Export singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();

/**
 * Initialize service worker
 */
export async function initializeServiceWorker(): Promise<SwRegistrationResult> {
  // Only register in production or when explicitly enabled
  if (process.env.NODE_ENV === 'development' && !localStorage.getItem('enableSW')) {
    console.log('[SW] Service worker disabled in development');
    return { success: false, error: new Error('Disabled in development') };
  }

  return await serviceWorkerManager.register();
}

/**
 * Check if app is running as PWA
 */
export function isPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.matchMedia('(display-mode: fullscreen)').matches ||
         (window.navigator as any).standalone === true;
}

/**
 * Check if device supports PWA installation
 */
export function canInstallPWA(): boolean {
  return 'serviceWorker' in navigator && 
         'BeforeInstallPromptEvent' in window;
}
