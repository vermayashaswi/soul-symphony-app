
import { serviceWorkerManager } from '@/utils/serviceWorker';
import { backgroundSyncService } from './backgroundSyncService';

export interface PeriodicSyncOptions {
  tag: string;
  minInterval: number; // in milliseconds
}

// Extend ServiceWorkerRegistration type to include periodicSync
interface ServiceWorkerRegistrationWithPeriodicSync extends ServiceWorkerRegistration {
  periodicSync?: {
    register(tag: string, options: { minInterval: number }): Promise<void>;
    unregister(tag: string): Promise<void>;
    getTags(): Promise<string[]>;
  };
}

class PeriodicSyncService {
  private static instance: PeriodicSyncService;
  private readonly JOURNAL_SYNC_TAG = 'journal-periodic-sync';
  private readonly INSIGHTS_REFRESH_TAG = 'insights-periodic-sync';
  
  static getInstance(): PeriodicSyncService {
    if (!PeriodicSyncService.instance) {
      PeriodicSyncService.instance = new PeriodicSyncService();
    }
    return PeriodicSyncService.instance;
  }

  /**
   * Check if periodic background sync is supported
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 
           'periodicSync' in window.ServiceWorkerRegistration.prototype;
  }

  /**
   * Register periodic sync for journal entries
   */
  async registerJournalSync(): Promise<boolean> {
    if (!this.isSupported()) {
      console.log('[PeriodicSync] Periodic sync not supported, falling back to manual sync');
      this.setupFallbackSync();
      return false;
    }

    if (!serviceWorkerManager.isServiceWorkerRegistered()) {
      console.warn('[PeriodicSync] Service worker not registered');
      return false;
    }

    try {
      const registration = serviceWorkerManager.getRegistration() as ServiceWorkerRegistrationWithPeriodicSync;
      
      if (!registration.periodicSync) {
        console.warn('[PeriodicSync] Periodic sync not available on registration');
        this.setupFallbackSync();
        return false;
      }

      // Register periodic sync every 12 hours (43200000 ms)
      await registration.periodicSync.register(this.JOURNAL_SYNC_TAG, {
        minInterval: 12 * 60 * 60 * 1000 // 12 hours
      });

      console.log('[PeriodicSync] Journal sync registered');
      return true;

    } catch (error) {
      console.error('[PeriodicSync] Failed to register journal sync:', error);
      this.setupFallbackSync();
      return false;
    }
  }

  /**
   * Register periodic sync for insights refresh
   */
  async registerInsightsSync(): Promise<boolean> {
    if (!this.isSupported()) {
      console.log('[PeriodicSync] Periodic sync not supported for insights');
      return false;
    }

    if (!serviceWorkerManager.isServiceWorkerRegistered()) {
      console.warn('[PeriodicSync] Service worker not registered');
      return false;
    }

    try {
      const registration = serviceWorkerManager.getRegistration() as ServiceWorkerRegistrationWithPeriodicSync;
      
      if (!registration.periodicSync) {
        console.warn('[PeriodicSync] Periodic sync not available on registration');
        return false;
      }

      // Register periodic sync every 6 hours for insights
      await registration.periodicSync.register(this.INSIGHTS_REFRESH_TAG, {
        minInterval: 6 * 60 * 60 * 1000 // 6 hours
      });

      console.log('[PeriodicSync] Insights sync registered');
      return true;

    } catch (error) {
      console.error('[PeriodicSync] Failed to register insights sync:', error);
      return false;
    }
  }

  /**
   * Unregister periodic sync
   */
  async unregister(tag: string): Promise<boolean> {
    if (!this.isSupported() || !serviceWorkerManager.isServiceWorkerRegistered()) {
      return false;
    }

    try {
      const registration = serviceWorkerManager.getRegistration() as ServiceWorkerRegistrationWithPeriodicSync;
      
      if (!registration.periodicSync) {
        return false;
      }

      await registration.periodicSync.unregister(tag);
      console.log('[PeriodicSync] Unregistered:', tag);
      return true;

    } catch (error) {
      console.error('[PeriodicSync] Failed to unregister:', tag, error);
      return false;
    }
  }

  /**
   * Get all registered periodic sync tags
   */
  async getRegisteredTags(): Promise<string[]> {
    if (!this.isSupported() || !serviceWorkerManager.isServiceWorkerRegistered()) {
      return [];
    }

    try {
      const registration = serviceWorkerManager.getRegistration() as ServiceWorkerRegistrationWithPeriodicSync;
      
      if (!registration.periodicSync) {
        return [];
      }

      return await registration.periodicSync.getTags();

    } catch (error) {
      console.error('[PeriodicSync] Failed to get registered tags:', error);
      return [];
    }
  }

  /**
   * Setup fallback sync using intervals when periodic sync is not available
   */
  private setupFallbackSync(): void {
    console.log('[PeriodicSync] Setting up fallback sync with intervals');
    
    // Check for pending syncs every 5 minutes when page is visible
    const syncInterval = setInterval(async () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        try {
          const pendingCount = await backgroundSyncService.getPendingCount();
          if (pendingCount > 0) {
            console.log('[PeriodicSync] Fallback sync: found pending items, triggering sync');
            await backgroundSyncService.manualSync();
          }
        } catch (error) {
          console.error('[PeriodicSync] Fallback sync error:', error);
        }
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Clear interval when page is unloaded
    window.addEventListener('beforeunload', () => {
      clearInterval(syncInterval);
    });

    // Also sync when page becomes visible
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        setTimeout(async () => {
          try {
            const pendingCount = await backgroundSyncService.getPendingCount();
            if (pendingCount > 0) {
              await backgroundSyncService.manualSync();
            }
          } catch (error) {
            console.error('[PeriodicSync] Visibility sync error:', error);
          }
        }, 1000);
      }
    });
  }

  /**
   * Initialize periodic sync services
   */
  async initialize(): Promise<void> {
    console.log('[PeriodicSync] Initializing periodic sync services...');
    
    // Register journal sync
    await this.registerJournalSync();
    
    // Register insights sync
    await this.registerInsightsSync();
    
    // Log current registrations
    const tags = await this.getRegisteredTags();
    console.log('[PeriodicSync] Registered periodic sync tags:', tags);
  }
}

// Export singleton instance
export const periodicSyncService = PeriodicSyncService.getInstance();
