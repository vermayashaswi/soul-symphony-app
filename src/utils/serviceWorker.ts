
/**
 * Simplified Service Worker Management
 */

export interface SwRegistrationResult {
  success: boolean;
  registration?: ServiceWorkerRegistration;
  error?: Error;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private isRegistered = false;

  async register(): Promise<SwRegistrationResult> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[SW Manager] Service workers not supported');
      return { success: false, error: new Error('Service workers not supported') };
    }

    try {
      console.log('[SW Manager] Registering simplified service worker...');
      
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });

      this.registration = registration;
      this.isRegistered = true;

      // Simple update handling
      registration.addEventListener('updatefound', () => {
        console.log('[SW Manager] Update found');
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[SW Manager] New version available - reloading');
              window.location.reload();
            }
          });
        }
      });

      console.log('[SW Manager] Service worker registered successfully');
      
      // Check for updates every 30 seconds
      setInterval(() => {
        this.checkForUpdates();
      }, 30000);
      
      return { success: true, registration };
      
    } catch (error) {
      console.error('[SW Manager] Service worker registration failed:', error);
      return { success: false, error: error as Error };
    }
  }

  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) return false;

    try {
      await this.registration.update();
      return true;
    } catch (error) {
      console.error('[SW Manager] Update check failed:', error);
      return false;
    }
  }

  async clearAllCaches(): Promise<boolean> {
    try {
      console.log('[SW Manager] Clearing all caches...');
      
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Clear storage except auth
      const keysToKeep = ['sb-auth-token'];
      const allKeys = Object.keys(localStorage);
      
      allKeys.forEach(key => {
        if (!keysToKeep.some(keepKey => key.includes(keepKey))) {
          localStorage.removeItem(key);
        }
      });
      
      sessionStorage.clear();
      return true;
    } catch (error) {
      console.error('[SW Manager] Cache clearing failed:', error);
      return false;
    }
  }

  isServiceWorkerRegistered(): boolean {
    return this.isRegistered && this.registration !== null;
  }

  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }
}

export const serviceWorkerManager = new ServiceWorkerManager();

export async function initializeServiceWorker(): Promise<SwRegistrationResult> {
  console.log('[SW Init] Initializing simplified service worker...');
  return await serviceWorkerManager.register();
}

export function isPWA(): boolean {
  const standaloneQuery = window.matchMedia('(display-mode: standalone)');
  const iOSStandalone = (window.navigator as any).standalone === true;
  return standaloneQuery.matches || iOSStandalone;
}
