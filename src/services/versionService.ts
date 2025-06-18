
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
      console.log('[VersionService] Checking for updates...');
      
      // Check service worker for updates
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration?.waiting) {
        console.log('[VersionService] Waiting service worker found');
        return {
          available: true,
          currentVersion: this.currentVersion.version,
          latestVersion: 'Latest',
          releaseNotes: 'App improvements and bug fixes available',
          mandatory: false
        };
      }

      // Force service worker update check
      if (registration) {
        console.log('[VersionService] Forcing service worker update check...');
        await registration.update();
        
        return new Promise((resolve) => {
          const checkTimeout = setTimeout(() => {
            resolve({
              available: false,
              currentVersion: this.currentVersion.version,
              latestVersion: this.currentVersion.version
            });
          }, 2000); // Reduced timeout for faster response
          
          registration.addEventListener('updatefound', () => {
            clearTimeout(checkTimeout);
            const newWorker = registration.installing;
            
            if (newWorker) {
              const handleStateChange = () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  newWorker.removeEventListener('statechange', handleStateChange);
                  resolve({
                    available: true,
                    currentVersion: this.currentVersion.version,
                    latestVersion: 'Latest',
                    releaseNotes: 'New version available with latest features',
                    mandatory: false
                  });
                }
              };
              
              newWorker.addEventListener('statechange', handleStateChange);
            }
          });
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
      console.log('[VersionService] Applying update...');
      
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration?.waiting) {
        // Clear all caches before updating
        await this.clearCache();
        
        // Send skip waiting message to the waiting service worker
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        
        // Wait for the new service worker to take control
        return new Promise((resolve) => {
          const handleControllerChange = () => {
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
            console.log('[VersionService] Controller changed, reloading...');
            
            // Force hard reload to ensure latest content
            window.location.reload();
            resolve(true);
          };
          
          navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
          
          // Fallback timeout
          setTimeout(() => {
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
            console.log('[VersionService] Timeout reached, forcing reload...');
            window.location.reload();
            resolve(true);
          }, 3000);
        });
      }

      return false;
    } catch (error) {
      console.error('[VersionService] Error applying update:', error);
      return false;
    }
  }

  startUpdatePolling(intervalMs: number = 30000) { // Reduced to 30 seconds
    this.stopUpdatePolling();
    
    console.log('[VersionService] Starting update polling...');
    
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
    
    console.log('[VersionService] Update polling stopped');
  }

  private notifyUpdateAvailable(updateInfo: UpdateInfo) {
    toast.info('App Update Available', {
      description: updateInfo.releaseNotes || 'New features and improvements ready',
      action: {
        label: 'Update',
        onClick: () => this.applyUpdate()
      },
      duration: 15000 // Longer duration for better visibility
    });
  }

  async clearCache(): Promise<void> {
    try {
      console.log('[VersionService] Clearing all caches...');
      
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          console.log('[VersionService] Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
      
      // Clear local storage cache markers
      const cacheKeys = Object.keys(localStorage).filter(key => 
        key.includes('cache') || key.includes('version') || key.includes('timestamp')
      );
      
      cacheKeys.forEach(key => {
        localStorage.removeItem(key);
      });
      
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

  // Force immediate update check and application
  async forceUpdate(): Promise<boolean> {
    console.log('[VersionService] Forcing immediate update...');
    
    try {
      // Clear all caches first
      await this.clearCache();
      
      // Check for updates
      const updateInfo = await this.checkForUpdates();
      
      if (updateInfo.available) {
        return await this.applyUpdate();
      } else {
        // Force service worker re-registration
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.unregister();
          // Re-register service worker
          await navigator.serviceWorker.register('/sw.js');
          // Reload page
          window.location.reload();
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('[VersionService] Force update failed:', error);
      return false;
    }
  }
}

export const versionService = new VersionService();
