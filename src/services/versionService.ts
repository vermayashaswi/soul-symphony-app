
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
  private isAutoUpdating: boolean = false;

  constructor() {
    this.currentVersion = {
      version: '1.0.1',
      buildDate: new Date().toISOString(),
      features: ['smartChatV2', 'premiumMessaging', 'journalVoicePlayback', 'themeConsistency'],
      cacheVersion: 'v1.0.1'
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
          }, 2000);
          
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

  private async applyAutomaticUpdate(): Promise<boolean> {
    try {
      console.log('[VersionService] Applying automatic update...');
      
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
            console.log('[VersionService] Automatic update applied, reloading...');
            
            // Show a brief notification
            toast.success('App updated to latest version!', {
              duration: 2000
            });
            
            // Delay reload slightly to show the toast
            setTimeout(() => {
              window.location.reload();
            }, 1000);
            
            resolve(true);
          };
          
          navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
          
          // Fallback timeout
          setTimeout(() => {
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
            console.log('[VersionService] Timeout reached, forcing reload...');
            window.location.reload();
            resolve(true);
          }, 5000);
        });
      }

      return false;
    } catch (error) {
      console.error('[VersionService] Error applying automatic update:', error);
      return false;
    }
  }

  startAutomaticUpdates(intervalMs: number = 60000) { // Check every minute
    this.stopAutomaticUpdates();
    
    console.log('[VersionService] Starting automatic update checking...');
    this.isAutoUpdating = true;
    
    this.updateCheckInterval = setInterval(async () => {
      if (!this.isAutoUpdating) return;
      
      const updateInfo = await this.checkForUpdates();
      if (updateInfo.available) {
        console.log('[VersionService] Update found, applying automatically...');
        await this.applyAutomaticUpdate();
      }
    }, intervalMs);

    // Also check immediately
    setTimeout(async () => {
      if (!this.isAutoUpdating) return;
      
      const updateInfo = await this.checkForUpdates();
      if (updateInfo.available) {
        console.log('[VersionService] Initial update found, applying automatically...');
        await this.applyAutomaticUpdate();
      }
    }, 5000); // Wait 5 seconds after app start
  }

  stopAutomaticUpdates() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
    
    this.isAutoUpdating = false;
    console.log('[VersionService] Automatic update checking stopped');
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
      
      // Clear local storage cache markers but preserve theme settings
      const cacheKeys = Object.keys(localStorage).filter(key => 
        key.includes('cache') || key.includes('version') || key.includes('timestamp')
      );
      
      cacheKeys.forEach(key => {
        localStorage.removeItem(key);
      });
      
      console.log('[VersionService] All caches cleared, theme settings preserved');
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
      // Clear all caches first (but preserve theme settings)
      await this.clearCache();
      
      // Check for updates
      const updateInfo = await this.checkForUpdates();
      
      if (updateInfo.available) {
        return await this.applyAutomaticUpdate();
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

  // Initialize theme consistency check
  initializeThemeConsistency(): void {
    console.log('[VersionService] Initializing theme consistency...');
    
    try {
      // Ensure theme CSS variables are set before first paint
      const root = document.documentElement;
      
      // Get stored theme preferences
      const storedColorTheme = localStorage.getItem('feelosophy-color-theme') || 'Default';
      
      // Apply immediate CSS variable based on stored theme
      let primaryColor = '#3b82f6'; // Default blue
      
      switch (storedColorTheme) {
        case 'Default':
          primaryColor = '#3b82f6';
          break;
        case 'Calm':
          primaryColor = '#8b5cf6';
          break;
        case 'Soothing':
          primaryColor = '#FFDEE2';
          break;
        case 'Energy':
          primaryColor = '#f59e0b';
          break;
        case 'Focus':
          primaryColor = '#10b981';
          break;
        case 'Custom':
          primaryColor = localStorage.getItem('feelosophy-custom-color') || '#3b82f6';
          break;
      }
      
      root.style.setProperty('--color-theme', primaryColor);
      root.style.setProperty('--primary', primaryColor);
      
      console.log('[VersionService] Theme consistency initialized:', { storedColorTheme, primaryColor });
      
    } catch (error) {
      console.warn('[VersionService] Theme consistency initialization failed:', error);
    }
  }
}

export const versionService = new VersionService();
