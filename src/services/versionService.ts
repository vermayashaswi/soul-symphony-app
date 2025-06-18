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
  private updateCheckCooldown: number = 10000; // Reduced to 10 seconds
  private forceRefreshTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.currentVersion = {
      version: '1.2.2', // Incremented for test
      buildDate: new Date().toISOString(),
      features: ['testPlan', 'comprehensiveUpdateFix', 'aggressiveCaching', 'forceRefresh', 'smartChatV2', 'premiumMessaging', 'journalVoicePlayback', 'themeConsistency', 'webViewCompatibility'],
      cacheVersion: 'soulo-cache-v1.2.2' // Match service worker cache name
    };
    
    this.setupServiceWorkerListeners();
    this.initializeForceRefreshHandling();
    
    console.log('[VersionService] TEST PLAN: Initialized with version', this.currentVersion.version);
    console.log('[VersionService] TEST PLAN: Build date', this.currentVersion.buildDate);
    console.log('[VersionService] TEST PLAN: Features', this.currentVersion.features);
  }

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

  private initializeForceRefreshHandling(): void {
    // Handle page visibility changes to check for updates
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[VersionService] Page became visible, checking for updates');
        setTimeout(() => {
          this.checkForUpdates();
        }, 1000);
      }
    });

    // Handle focus events
    window.addEventListener('focus', () => {
      console.log('[VersionService] Window focused, checking for updates');
      setTimeout(() => {
        this.checkForUpdates();
      }, 500);
    });
  }

  private setupServiceWorkerListeners(): void {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('[VersionService] Service worker message:', event.data);
      
      switch (event.data.type) {
        case 'SW_ACTIVATED':
          this.handleServiceWorkerActivated(event.data);
          break;
        case 'UPDATE_AVAILABLE':
          this.handleUpdateAvailable(event.data);
          break;
        case 'FORCE_REFRESH':
          this.handleForceRefresh(event.data);
          break;
        case 'SW_UPDATED':
          this.handleServiceWorkerUpdated(event.data);
          break;
      }
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[VersionService] Service worker controller changed - forcing refresh');
      this.executeForceRefresh('Service worker updated');
    });
  }

  private handleServiceWorkerActivated(data: any): void {
    console.log('[VersionService] Service worker activated:', data);
    
    if (data.forceRefresh) {
      toast.success('App Updated!', {
        description: 'New version is active. Refreshing...',
        duration: 2000
      });
      
      setTimeout(() => {
        this.executeForceRefresh('Service worker activated');
      }, 2000);
    } else {
      toast.success('App Ready', {
        description: 'Latest version is now active',
        duration: 3000
      });
    }
    
    // Update version info
    if (data.version && data.version !== this.currentVersion.version) {
      this.currentVersion.version = data.version;
      this.currentVersion.cacheVersion = data.cacheVersion || this.currentVersion.cacheVersion;
    }
  }

  private handleUpdateAvailable(data: any): void {
    console.log('[VersionService] Update available:', data);
    
    toast.info('Update Available!', {
      description: 'Tap to update to the latest version',
      duration: 0, // Don't auto-dismiss
      action: {
        label: 'Update Now',
        onClick: () => this.forceUpdate()
      }
    });
  }

  private handleForceRefresh(data: any): void {
    console.log('[VersionService] Force refresh requested:', data);
    
    toast.info('Updating App...', {
      description: 'Refreshing to latest version',
      duration: 2000
    });
    
    setTimeout(() => {
      this.executeForceRefresh(data.reason || 'Update required');
    }, 2000);
  }

  private handleServiceWorkerUpdated(data: any): void {
    console.log('[VersionService] Service worker updated:', data);
    
    toast.success('Update Downloaded', {
      description: 'New version ready to install',
      duration: 5000,
      action: {
        label: 'Activate',
        onClick: () => this.forceUpdate()
      }
    });
  }

  private executeForceRefresh(reason: string): void {
    console.log(`[VersionService] Executing force refresh: ${reason}`);
    
    // Clear any existing timeout
    if (this.forceRefreshTimeout) {
      clearTimeout(this.forceRefreshTimeout);
    }
    
    // Add cache-busting parameters
    const url = new URL(window.location.href);
    url.searchParams.set('_refresh', Date.now().toString());
    url.searchParams.set('_v', this.currentVersion.version);
    
    // Force reload with cache bypass
    if (this.isWebView()) {
      // For WebView, use location.replace to ensure complete refresh
      window.location.replace(url.toString());
    } else {
      // For browsers, use reload with cache bypass
      window.location.href = url.toString();
    }
  }

  getCurrentVersion(): AppVersion {
    console.log('[VersionService] TEST PLAN: getCurrentVersion called', this.currentVersion);
    return this.currentVersion;
  }

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
      console.log('[VersionService] Checking for updates with aggressive detection...');
      
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (!registration) {
        console.log('[VersionService] No service worker registration found');
        return {
          available: false,
          currentVersion: this.currentVersion.version,
          latestVersion: this.currentVersion.version
        };
      }

      // Check for waiting service worker first
      if (registration.waiting) {
        console.log('[VersionService] Waiting service worker found - update available');
        return {
          available: true,
          currentVersion: this.currentVersion.version,
          latestVersion: 'Latest',
          releaseNotes: 'Comprehensive update fixes and improvements',
          mandatory: false
        };
      }

      // Force aggressive update check
      console.log('[VersionService] Forcing aggressive service worker update check...');
      await registration.update();
      
      // Wait a bit and check again
      return new Promise((resolve) => {
        const checkTimeout = setTimeout(() => {
          console.log('[VersionService] Update check timeout');
          resolve({
            available: false,
            currentVersion: this.currentVersion.version,
            latestVersion: this.currentVersion.version
          });
        }, 3000); // Reduced timeout

        const handleUpdateFound = () => {
          clearTimeout(checkTimeout);
          registration.removeEventListener('updatefound', handleUpdateFound);
          
          const newWorker = registration.installing;
          if (newWorker) {
            console.log('[VersionService] New service worker detected during update check');
            
            const handleStateChange = () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.removeEventListener('statechange', handleStateChange);
                resolve({
                  available: true,
                  currentVersion: this.currentVersion.version,
                  latestVersion: 'Latest',
                  releaseNotes: 'New version with comprehensive fixes',
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

  startAutomaticUpdates(intervalMs: number = 30000) { // Reduced to 30 seconds
    this.stopAutomaticUpdates();
    
    console.log('[VersionService] Starting aggressive automatic update checking...');
    this.isAutoUpdating = true;
    
    this.updateCheckInterval = setInterval(async () => {
      if (!this.isAutoUpdating) return;
      
      try {
        const updateInfo = await this.checkForUpdates();
        if (updateInfo.available) {
          console.log('[VersionService] Automatic update found, notifying user...');
          
          toast.info('Update Ready!', {
            description: 'New version available - tap to update',
            duration: 10000,
            action: {
              label: 'Update Now',
              onClick: () => this.forceUpdate()
            }
          });
        }
      } catch (error) {
        console.error('[VersionService] Automatic update check failed:', error);
      }
    }, intervalMs);

    // Initial check after short delay
    setTimeout(async () => {
      if (!this.isAutoUpdating) return;
      
      try {
        const updateInfo = await this.checkForUpdates();
        if (updateInfo.available) {
          console.log('[VersionService] Initial update check found update');
          
          toast.info('Update Available', {
            description: 'New version ready to install',
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
    }, 5000); // Reduced delay
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
      console.log('[VersionService] Clearing all application caches...');
      
      // Clear all caches
      const cacheNames = await caches.keys();
      const deletionPromises = cacheNames.map(cacheName => {
        console.log('[VersionService] Deleting cache:', cacheName);
        return caches.delete(cacheName);
      });
      
      await Promise.all(deletionPromises);
      
      // Clear service worker cache via message
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && registration.active) {
        return new Promise((resolve) => {
          const messageChannel = new MessageChannel();
          messageChannel.port1.onmessage = (event) => {
            console.log('[VersionService] Cache clear response:', event.data);
            resolve();
          };
          
          registration.active.postMessage(
            { type: 'CLEAR_CACHE' },
            [messageChannel.port2]
          );
          
          // Timeout after 3 seconds
          setTimeout(resolve, 3000);
        });
      }
      
      // Clear relevant localStorage items
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
      
      console.log('[VersionService] Comprehensive cache clearing completed');
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

  async forceUpdate(): Promise<boolean> {
    console.log('[VersionService] Forcing comprehensive update...');
    
    try {
      toast.info('Updating App...', {
        description: 'Clearing cache and applying updates',
        duration: 3000
      });
      
      // Step 1: Clear all caches
      await this.clearCache();
      
      // Step 2: Get registration and force update
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration) {
        // Force update check
        await registration.update();
        
        // If there's a waiting service worker, activate it
        if (registration.waiting) {
          console.log('[VersionService] Activating waiting service worker...');
          
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          
          // Wait for controller change or timeout
          return new Promise((resolve) => {
            const handleControllerChange = () => {
              navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
              console.log('[VersionService] Controller changed, forcing refresh...');
              
              setTimeout(() => {
                this.executeForceRefresh('Service worker updated');
              }, 1000);
              
              resolve(true);
            };
            
            navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
            
            // Fallback timeout
            setTimeout(() => {
              navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
              console.log('[VersionService] Update timeout, forcing refresh anyway...');
              this.executeForceRefresh('Update timeout');
              resolve(true);
            }, 5000);
          });
        } else {
          // No waiting worker, force refresh anyway
          console.log('[VersionService] No waiting service worker, forcing refresh...');
          
          toast.success('Cache Cleared', {
            description: 'Refreshing app to ensure latest version',
            duration: 2000
          });
          
          setTimeout(() => {
            this.executeForceRefresh('Force update requested');
          }, 2000);
          
          return true;
        }
      } else {
        console.log('[VersionService] No service worker registration');
        
        toast.error('Update Error', {
          description: 'Unable to update. Please refresh manually.',
          duration: 5000
        });
        
        return false;
      }
      
    } catch (error) {
      console.error('[VersionService] Force update failed:', error);
      
      toast.error('Update Failed', {
        description: 'Please refresh the page manually',
        duration: 5000
      });
      
      // Force refresh anyway as fallback
      setTimeout(() => {
        this.executeForceRefresh('Update error fallback');
      }, 3000);
      
      return false;
    }
  }

  async triggerManualUpdate(): Promise<void> {
    console.log('[VersionService] Manual update triggered with aggressive detection');
    
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        // Send message to service worker
        registration.active?.postMessage({ type: 'CHECK_UPDATE' });
        
        // Force our own update check
        const updateInfo = await this.checkForUpdates();
        
        if (updateInfo.available) {
          toast.success('Update Found!', {
            description: 'New version is ready to install',
            duration: 5000,
            action: {
              label: 'Install Now',
              onClick: () => this.forceUpdate()
            }
          });
        } else {
          toast.success('Up to Date', {
            description: 'You have the latest version',
            duration: 3000
          });
        }
      }
    } catch (error) {
      console.error('[VersionService] Manual update trigger failed:', error);
      toast.error('Update Check Failed', {
        description: 'Unable to check for updates',
        duration: 3000
      });
    }
  }

  initializeThemeConsistency(): void {
    console.log('[VersionService] Initializing enhanced theme consistency...');
    
    try {
      const root = document.documentElement;
      const body = document.body;
      
      const storedTheme = localStorage.getItem('feelosophy-theme') || 'system';
      const storedColorTheme = localStorage.getItem('feelosophy-color-theme') || 'Default';
      
      let primaryColor = '#3b82f6';
      
      switch(storedColorTheme) {
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
      
      if (this.isWebView()) {
        console.log('[VersionService] WebView detected, applying enhanced compatibility');
        
        body.classList.add('webview-environment');
        
        const themeMode = storedTheme === 'system' 
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : storedTheme;
        
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
        
        root.classList.remove('light', 'dark');
        root.classList.add(themeMode);
        
        // Enhanced WebView styles
        const webViewStyle = document.createElement('style');
        webViewStyle.id = 'webview-enhanced-styles';
        webViewStyle.textContent = `
          .webview-environment {
            -webkit-user-select: none !important;
            -webkit-touch-callout: none !important;
            -webkit-tap-highlight-color: transparent !important;
            contain: layout style paint !important;
            isolation: isolate !important;
            will-change: transform !important;
          }
          
          .webview-environment * {
            -webkit-transform: translate3d(0, 0, 0);
            transform: translate3d(0, 0, 0);
            will-change: transform;
          }
          
          /* Cache busting styles */
          .cache-bust {
            background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB2aWV3Qm94PSIwIDAgMSAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==');
          }
        `;
        document.head.appendChild(webViewStyle);
      }
      
      console.log('[VersionService] Enhanced theme consistency initialized', { 
        storedColorTheme, 
        primaryColor, 
        isWebView: this.isWebView(),
        version: this.currentVersion.version
      });
      
    } catch (error) {
      console.warn('[VersionService] Theme consistency initialization failed:', error);
    }
  }
}

export const versionService = new VersionService();
