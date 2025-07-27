/**
 * Service Worker Registration and Management - Enhanced for TWA Updates
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

  /**
   * Register the service worker with enhanced update handling
   */
  async register(): Promise<SwRegistrationResult> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[SW] Service workers not supported');
      return { success: false, error: new Error('Service workers not supported') };
    }

    try {
      console.log('[SW] Registering enhanced service worker...');
      
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none' // Ensure SW updates are checked
      });

      this.registration = registration;
      this.isRegistered = true;

      // Enhanced update handling
      registration.addEventListener('updatefound', () => {
        console.log('[SW] Update found, installing new version...');
        this.handleUpdate(registration);
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', this.handleMessage.bind(this));

      // Force check for updates on registration
      registration.update();

      console.log('[SW] Enhanced service worker registered successfully');
      
      return { success: true, registration };
      
    } catch (error) {
      console.error('[SW] Service worker registration failed:', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Force clear all caches and reload
   */
  async forceCacheRefresh(): Promise<void> {
    try {
      console.log('[SW] Forcing cache refresh...');
      
      if (this.registration && this.registration.active) {
        // Send message to SW to clear caches
        this.registration.active.postMessage({ type: 'CLEAR_CACHE' });
      }

      // Clear browser caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => {
            console.log('[SW] Clearing cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }

      // Add cache bust parameter and reload
      const cacheBustValue = Date.now();
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('v', cacheBustValue.toString());
      
      setTimeout(() => {
        window.location.href = currentUrl.toString();
      }, 500);
      
    } catch (error) {
      console.error('[SW] Error forcing cache refresh:', error);
      // Fallback to simple reload
      window.location.reload();
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
    if (!this.registration) {
      console.warn('[SW] No service worker registration available');
      return false;
    }

    // Type guard to check if sync is available
    const registrationWithSync = this.registration as ServiceWorkerRegistrationWithSync;
    
    if (!registrationWithSync.sync) {
      console.warn('[SW] Background sync not supported');
      return false;
    }

    try {
      await registrationWithSync.sync.register(tag);
      console.log('[SW] Background sync registered:', tag);
      return true;
    } catch (error) {
      console.error('[SW] Failed to register background sync:', error);
      return false;
    }
  }

  /**
   * Handle service worker updates with aggressive cache clearing
   */
  private handleUpdate(registration: ServiceWorkerRegistration) {
    const newWorker = registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        console.log('[SW] New content is available, clearing caches...');
        
        // Clear caches and force reload
        this.forceCacheRefresh();
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
    } else if (event.data.type === 'JOURNAL_REMINDER_SCHEDULED') {
      this.handleJournalReminderScheduled(event.data.payload);
    } else if (event.data.type === 'JOURNAL_REMINDER_ERROR') {
      this.handleJournalReminderError(event.data.payload);
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
   * Handle journal reminder scheduled confirmation
   */
  private handleJournalReminderScheduled(payload: any) {
    console.log('[SW] Journal reminder scheduled:', payload);
    window.dispatchEvent(new CustomEvent('journalReminderScheduled', {
      detail: payload
    }));
  }

  /**
   * Handle journal reminder errors
   */
  private handleJournalReminderError(payload: any) {
    console.error('[SW] Journal reminder error:', payload);
    window.dispatchEvent(new CustomEvent('journalReminderError', {
      detail: payload
    }));
  }

  /**
   * Schedule journal reminder through service worker
   */
  async scheduleJournalReminder(time: string, delay: number): Promise<boolean> {
    if (!this.registration || !this.registration.active) {
      console.warn('[SW] No active service worker for reminder scheduling');
      return false;
    }

    try {
      this.registration.active.postMessage({
        type: 'SCHEDULE_JOURNAL_REMINDER',
        payload: { time, delay, timestamp: Date.now() }
      });
      
      console.log('[SW] Journal reminder schedule request sent:', { time, delay });
      return true;
    } catch (error) {
      console.error('[SW] Failed to schedule journal reminder:', error);
      return false;
    }
  }

  /**
   * Clear all journal reminders in service worker
   */
  async clearJournalReminders(): Promise<void> {
    if (!this.registration || !this.registration.active) {
      console.warn('[SW] No active service worker for clearing reminders');
      return;
    }

    try {
      this.registration.active.postMessage({
        type: 'CLEAR_JOURNAL_REMINDERS'
      });
      
      console.log('[SW] Journal reminder clear request sent');
    } catch (error) {
      console.error('[SW] Failed to clear journal reminders:', error);
    }
  }

  /**
   * Get the current registration
   */
  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }

  /**
   * Skip waiting and activate new service worker immediately
   */
  async skipWaiting(): Promise<void> {
    if (!this.registration || !this.registration.waiting) {
      return;
    }

    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    
    // Force cache refresh after activation
    setTimeout(() => {
      this.forceCacheRefresh();
    }, 1000);
  }
}

// Export singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();

/**
 * Initialize service worker with enhanced update handling
 */
export async function initializeServiceWorker(): Promise<SwRegistrationResult> {
  // Always register in TWA environment for update handling
  const twaEnv = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true;
  
  if (process.env.NODE_ENV === 'development' && !localStorage.getItem('enableSW') && !twaEnv) {
    console.log('[SW] Service worker disabled in development (not TWA)');
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
