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
  private lastUpdateCheck: number = 0;
  private updateCheckCooldown: number = 30000; // 30 seconds

  constructor() {
    this.currentVersion = {
      version: '1.2.0', // Updated to match service worker
      buildDate: new Date().toISOString(),
      features: ['smartChatV2', 'premiumMessaging', 'journalVoicePlayback', 'themeConsistency', 'webViewCompatibility', 'enhancedUpdates'],
      cacheVersion: 'soulo-cache-v1.2.0' // Match service worker cache name
    };
    
    // Listen for service worker messages
    this.setupServiceWorkerListeners();
    
    console.log('[VersionService] Initialized', this.currentVersion);
  }

  // WebView detection utility
  private isWebView(): boolean {
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

  // Enhanced service worker listener setup
  private setupServiceWorkerListeners(): void {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('[VersionService] Service worker message:', event.data);
      
      switch (event.data.type) {
        case 'SW_UPDATED':
          this.handleServiceWorkerUpdated(event.data);
          break;
        case 'SW_ACTIVATED':
          this.handleServiceWorkerActivated(event.data);
          break;
        case 'UPDATE_AVAILABLE':
          this.handleUpdateAvailable(event.data);
          break;
      }
    });

    // Listen for service worker updates
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[VersionService] Service worker controller changed');
      toast.success('App updated successfully!', {
        description: 'The latest version is now active',
        duration: 3000
      });
    });
  }

  private handleServiceWorkerUpdated(data: any): void {
    console.log('[VersionService] Service worker updated:', data);
    toast.success('Update Available!', {
      description: 'A new version has been downloaded and will be active soon',
      duration: 4000
    });
  }

  private handleServiceWorkerActivated(data: any): void {
    console.log('[VersionService] Service worker activated:', data);
    // Update current version info if provided
    if (data.version && data.version !== this.currentVersion.version) {
      this.currentVersion.version = data.version;
      this.currentVersion.cacheVersion = data.cacheVersion || this.currentVersion.cacheVersion;
    }
  }

  private handleUpdateAvailable(data: any): void {
    console.log('[VersionService] Update available:', data);
    toast.info('New Version Available', {
      description: 'Tap here to update the app',
      duration: 10000,
      action: {
        label: 'Update Now',
        onClick: () => this.forceUpdate()
      }
    });
  }

  getCurrentVersion(): AppVersion {
    return this.currentVersion;
  }

  // Enhanced update checking with better detection
  async checkForUpdates(): Promise<UpdateInfo> {
    const now = Date.now();
    if (now - this.lastUpdateCheck < this.updateCheckCooldown) {
      console.log('[VersionService] Update check on cooldown');
      return {
        available: false,
        currentVersion: this.currentVersion.version,
        latestVersion: this.currentVersion.version
      };
    }

    this.lastUpdateCheck = now;

    try {
      console.log('[VersionService] Checking for updates...');
      
      // Get service worker registration
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (!registration) {
        console.log('[VersionService] No service worker registration found');
        return {
          available: false,
          currentVersion: this.currentVersion.version,
          latestVersion: this.currentVersion.version
        };
      }

      // Check for waiting service worker
      if (registration.waiting) {
        console.log('[VersionService] Waiting service worker found');
        return {
          available: true,
          currentVersion: this.currentVersion.version,
          latestVersion: 'Latest',
          releaseNotes: 'App improvements and bug fixes available',
          mandatory: false
        };
      }

      // Force update check
      console.log('[VersionService] Forcing service worker update check...');
      await registration.update();
      
      // Check again after forced update
      return new Promise((resolve) => {
        const checkTimeout = setTimeout(() => {
          console.log('[VersionService] Update check timeout');
          resolve({
            available: false,
            currentVersion: this.currentVersion.version,
            latestVersion: this.currentVersion.version
          });
        }, 5000);
        
        const handleUpdateFound = () => {
          clearTimeout(checkTimeout);
          registration.removeEventListener('updatefound', handleUpdateFound);
          
          const newWorker = registration.installing;
          if (newWorker) {
            console.log('[VersionService] New service worker installing');
            
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
        };
        
        registration.addEventListener('updatefound', handleUpdateFound);
      });

    } catch (error) {
      console.error('[VersionService] Error checking for updates:', error);
      return {
        available: false,
        currentVersion: this.currentVersion.version,
        latestVersion: this.currentVersion.version
      };
    }
  }

  // Enhanced automatic update with user notification
  private async applyAutomaticUpdate(): Promise<boolean> {
    try {
      console.log('[VersionService] Applying automatic update...');
      
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration?.waiting) {
        console.log('[VersionService] Activating waiting service worker...');
        
        // Clear caches before updating
        await this.clearCache();
        
        // Send skip waiting message
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        
        // Show update notification
        toast.info('Updating App...', {
          description: 'Please wait while we apply the latest updates',
          duration: 3000
        });
        
        // Wait for controller change
        return new Promise((resolve) => {
          const handleControllerChange = () => {
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
            console.log('[VersionService] Update applied successfully');
            
            toast.success('Update Complete!', {
              description: 'App has been updated to the latest version',
              duration: 3000
            });
            
            // Reload after a short delay
            setTimeout(() => {
              window.location.reload();
            }, 1500);
            
            resolve(true);
          };
          
          navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
          
          // Fallback timeout
          setTimeout(() => {
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
            console.log('[VersionService] Update timeout, forcing reload...');
            window.location.reload();
            resolve(true);
          }, 8000);
        });
      }

      console.log('[VersionService] No waiting service worker found');
      return false;
    } catch (error) {
      console.error('[VersionService] Error applying automatic update:', error);
      toast.error('Update Failed', {
        description: 'Please refresh the page to get the latest version',
        duration: 5000
      });
      return false;
    }
  }

  // Enhanced automatic updates with better user experience
  startAutomaticUpdates(intervalMs: number = 90000) { // Increased to 90 seconds
    this.stopAutomaticUpdates();
    
    console.log('[VersionService] Starting automatic update checking...');
    this.isAutoUpdating = true;
    
    this.updateCheckInterval = setInterval(async () => {
      if (!this.isAutoUpdating) return;
      
      try {
        const updateInfo = await this.checkForUpdates();
        if (updateInfo.available) {
          console.log('[VersionService] Update found, applying automatically...');
          await this.applyAutomaticUpdate();
        }
      } catch (error) {
        console.error('[VersionService] Automatic update check failed:', error);
      }
    }, intervalMs);

    // Initial check after delay
    setTimeout(async () => {
      if (!this.isAutoUpdating) return;
      
      try {
        const updateInfo = await this.checkForUpdates();
        if (updateInfo.available) {
          console.log('[VersionService] Initial update found');
          // Show notification instead of immediate update
          toast.info('Update Available', {
            description: 'Tap to update to the latest version',
            duration: 8000,
            action: {
              label: 'Update',
              onClick: () => this.forceUpdate()
            }
          });
        }
      } catch (error) {
        console.error('[VersionService] Initial update check failed:', error);
      }
    }, 10000); // Wait 10 seconds after app start
  }

  stopAutomaticUpdates() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
    
    this.isAutoUpdating = false;
    console.log('[VersionService] Automatic update checking stopped');
  }

  // Enhanced cache clearing with preservation of important data
  async clearCache(): Promise<void> {
    try {
      console.log('[VersionService] Clearing application caches...');
      
      const cacheNames = await caches.keys();
      const deletionPromises = cacheNames.map(cacheName => {
        console.log('[VersionService] Deleting cache:', cacheName);
        return caches.delete(cacheName);
      });
      
      await Promise.all(deletionPromises);
      
      // Clear local storage cache markers but preserve user data
      const cacheKeys = Object.keys(localStorage).filter(key => 
        key.includes('cache') || 
        key.includes('version') || 
        key.includes('timestamp') ||
        key.includes('sw-')
      );
      
      cacheKeys.forEach(key => {
        console.log('[VersionService] Removing localStorage key:', key);
        localStorage.removeItem(key);
      });
      
      console.log('[VersionService] Cache clearing completed');
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

  // Enhanced force update with better user feedback
  async forceUpdate(): Promise<boolean> {
    console.log('[VersionService] Forcing immediate update...');
    
    try {
      toast.info('Checking for Updates...', {
        description: 'Please wait while we check for the latest version',
        duration: 2000
      });
      
      // Clear caches first
      await this.clearCache();
      
      // Get fresh service worker registration
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration) {
        // Force update check
        await registration.update();
        
        // Check for updates
        const updateInfo = await this.checkForUpdates();
        
        if (updateInfo.available) {
          console.log('[VersionService] Update available, applying...');
          return await this.applyAutomaticUpdate();
        } else {
          // Force re-registration if no update found
          console.log('[VersionService] No update found, re-registering service worker...');
          
          await registration.unregister();
          await navigator.serviceWorker.register('/sw.js');
          
          toast.success('App Refreshed', {
            description: 'The app has been refreshed with the latest resources',
            duration: 3000
          });
          
          setTimeout(() => {
            window.location.reload();
          }, 1500);
          
          return true;
        }
      } else {
        console.log('[VersionService] No service worker registration found');
        toast.error('Update Error', {
          description: 'Unable to check for updates. Please refresh the page.',
          duration: 5000
        });
        return false;
      }
      
    } catch (error) {
      console.error('[VersionService] Force update failed:', error);
      toast.error('Update Failed', {
        description: 'Please refresh the page manually to get the latest version',
        duration: 5000
      });
      return false;
    }
  }

  // Manual update trigger for user-initiated updates
  async triggerManualUpdate(): Promise<void> {
    console.log('[VersionService] Manual update triggered');
    
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        // Send message to service worker to check for updates
        registration.active?.postMessage({ type: 'CHECK_UPDATE' });
        
        toast.info('Checking for Updates...', {
          description: 'Looking for the latest version',
          duration: 3000
        });
        
        // Also force our own update check
        setTimeout(async () => {
          const updateInfo = await this.checkForUpdates();
          if (!updateInfo.available) {
            toast.success('Already Up to Date', {
              description: 'You have the latest version',
              duration: 3000
            });
          }
        }, 2000);
      }
    } catch (error) {
      console.error('[VersionService] Manual update trigger failed:', error);
      toast.error('Update Check Failed', {
        description: 'Unable to check for updates',
        duration: 3000
      });
    }
  }

  // Enhanced initialize theme consistency with WebView support
  initializeThemeConsistency(): void {
    console.log('[VersionService] Initializing theme consistency with WebView support...');
    
    try {
      // Ensure theme CSS variables are set before first paint
      const root = document.documentElement;
      const body = document.body;
      
      // Get stored theme preferences
      const storedTheme = localStorage.getItem('feelosophy-theme') || 'system';
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
      
      // WebView-specific initialization
      if (this.isWebView()) {
        console.log('[VersionService] WebView detected, applying compatibility fixes');
        
        // Apply WebView body class immediately
        body.classList.add('webview-environment');
        
        // Determine theme mode
        const themeMode = storedTheme === 'system' 
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : storedTheme;
        
        // Force background colors for WebView
        if (themeMode === 'light') {
          body.style.backgroundColor = '#ffffff';
          root.style.backgroundColor = '#ffffff';
          root.style.setProperty('--background', '0 0% 100%');
          root.style.setProperty('--card', '0 0% 100%');
        } else {
          body.style.backgroundColor = '#0a0a0a';
          root.style.backgroundColor = '#0a0a0a';
          root.style.setProperty('--background', '0 0% 3.9%');
          root.style.setProperty('--card', '0 0% 3.9%');
        }
        
        // Apply theme class
        root.classList.remove('light', 'dark');
        root.classList.add(themeMode);
        
        // WebView-specific CSS injection
        const webViewStyle = document.createElement('style');
        webViewStyle.id = 'webview-init-styles';
        webViewStyle.textContent = `
          .webview-environment {
            -webkit-user-select: none !important;
            -webkit-touch-callout: none !important;
            -webkit-tap-highlight-color: transparent !important;
            contain: layout style paint !important;
            isolation: isolate !important;
          }
          
          .webview-environment * {
            -webkit-transform: translate3d(0, 0, 0);
            transform: translate3d(0, 0, 0);
          }
        `;
        document.head.appendChild(webViewStyle);
      }
      
      console.log('[VersionService] Theme consistency initialized:', { 
        storedColorTheme, 
        primaryColor, 
        isWebView: this.isWebView(),
        storedTheme
      });
      
    } catch (error) {
      console.warn('[VersionService] Theme consistency initialization failed:', error);
    }
  }
}

export const versionService = new VersionService();
