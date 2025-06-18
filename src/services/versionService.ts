
import { toast } from 'sonner';

export interface AppVersion {
  version: string;
  buildDate: string;
  features: string[];
  cacheVersion: string;
}

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  updateSize?: string;
  releaseNotes?: string;
  mandatory?: boolean;
}

class VersionService {
  private currentVersion: AppVersion;
  private updateCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.currentVersion = {
      version: '1.0.0',
      buildDate: new Date().toISOString(),
      features: ['smartChatV2', 'premiumMessaging', 'journalVoicePlayback'],
      cacheVersion: 'v1.0.0'
    };
  }

  getCurrentVersion(): AppVersion {
    return this.currentVersion;
  }

  async checkForUpdates(): Promise<UpdateInfo> {
    try {
      // Check service worker for updates
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration?.waiting) {
        return {
          available: true,
          currentVersion: this.currentVersion.version,
          latestVersion: 'Latest',
          releaseNotes: 'App improvements and bug fixes available'
        };
      }

      // Check for new service worker
      if (registration) {
        await registration.update();
        
        return new Promise((resolve) => {
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  resolve({
                    available: true,
                    currentVersion: this.currentVersion.version,
                    latestVersion: 'Latest',
                    releaseNotes: 'New version available with latest features'
                  });
                }
              });
            }
          });

          // If no update found after 3 seconds, resolve with no update
          setTimeout(() => {
            resolve({
              available: false,
              currentVersion: this.currentVersion.version,
              latestVersion: this.currentVersion.version
            });
          }, 3000);
        });
      }

      return {
        available: false,
        currentVersion: this.currentVersion.version,
        latestVersion: this.currentVersion.version
      };

    } catch (error) {
      console.error('[VersionService] Error checking for updates:', error);
      return {
        available: false,
        currentVersion: this.currentVersion.version,
        latestVersion: this.currentVersion.version
      };
    }
  }

  async applyUpdate(): Promise<boolean> {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration?.waiting) {
        // Send skip waiting message to the waiting service worker
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        
        // Wait for the new service worker to take control
        return new Promise((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
            resolve(true);
          });
        });
      }

      return false;
    } catch (error) {
      console.error('[VersionService] Error applying update:', error);
      return false;
    }
  }

  startUpdatePolling(intervalMs: number = 300000) { // 5 minutes
    this.stopUpdatePolling();
    
    this.updateCheckInterval = setInterval(async () => {
      const updateInfo = await this.checkForUpdates();
      if (updateInfo.available) {
        this.notifyUpdateAvailable(updateInfo);
      }
    }, intervalMs);
  }

  stopUpdatePolling() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }

  private notifyUpdateAvailable(updateInfo: UpdateInfo) {
    toast.info('App Update Available', {
      description: updateInfo.releaseNotes || 'New features and improvements ready',
      action: {
        label: 'Update',
        onClick: () => this.applyUpdate()
      },
      duration: 10000
    });
  }

  async clearCache(): Promise<void> {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('[VersionService] All caches cleared');
    } catch (error) {
      console.error('[VersionService] Error clearing cache:', error);
    }
  }

  async getCacheSize(): Promise<string> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usedMB = (estimate.usage || 0) / (1024 * 1024);
        return `${usedMB.toFixed(2)} MB`;
      }
      return 'Unknown';
    } catch (error) {
      console.error('[VersionService] Error getting cache size:', error);
      return 'Error';
    }
  }
}

export const versionService = new VersionService();
