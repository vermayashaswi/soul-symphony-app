import { toast } from 'sonner';
import { nativeAppService } from './nativeAppService';

export interface AppVersion {
  version: string;
  buildDate: string;
  features: string[];
  cacheVersion: string;
  nativeAppSupport: boolean;
}

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  updateSize?: string;
  releaseNotes?: string;
  mandatory?: boolean;
  isNativeApp?: boolean;
}

class VersionService {
  private currentVersion: AppVersion;
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private isAutoUpdating: boolean = false;
  private lastUpdateCheck: number = 0;
  private updateCheckCooldown: number = 8000; // Reduced for native apps
  private forceRefreshTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.currentVersion = {
      version: '1.2.3', // Incremented for native app fixes
      buildDate: new Date().toISOString(),
      features: ['nativeAppFix', 'webViewCacheClearing', 'enhancedRouting', 'testPlan', 'comprehensiveUpdateFix', 'aggressiveCaching', 'forceRefresh', 'smartChatV2', 'premiumMessaging', 'journalVoicePlayback', 'themeConsistency', 'webViewCompatibility'],
      cacheVersion: 'soulo-cache-v1.2.3', // Updated cache version
      nativeAppSupport: true
    };
    
    this.setupServiceWorkerListeners();
    this.initializeNativeAppSupport();
    
    console.log('[VersionService] NATIVE FIX: Initialized with version', this.currentVersion.version);
    console.log('[VersionService] NATIVE FIX: Native app support enabled');
  }

  private initializeNativeAppSupport(): void {
    const isNative = nativeAppService.isNativeApp();
    
    console.log('[VersionService] NATIVE FIX: Native app detected:', isNative);
    
    if (isNative) {
      // Ensure proper routing for native apps
      nativeAppService.ensureAppRoute();
      
      // Start native-specific update checking
      nativeAppService.startNativeUpdateChecking();
      
      // Handle page visibility for native apps
      this.initializeNativeVisibilityHandling();
    }
    
    this.initializeForceRefreshHandling();
  }

  private initializeNativeVisibilityHandling(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && nativeAppService.isNativeApp()) {
        console.log('[VersionService] NATIVE FIX: Native app became visible, checking updates');
        setTimeout(() => {
          this.checkForUpdates();
        }, 500);
      }
    });

    window.addEventListener('focus', () => {
      if (nativeAppService.isNativeApp()) {
        console.log('[VersionService] NATIVE FIX: Native app focused, checking updates');
        setTimeout(() => {
          this.checkForUpdates();
        }, 300);
      }
    });
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
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[VersionService] Page became visible, checking for updates');
        setTimeout(() => {
          this.checkForUpdates();
        }, 1000);
      }
    });

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
      console.log('[VersionService] NATIVE FIX: Service worker message:', event.data);
      
      const isNative = nativeAppService.isNativeApp();
      
      switch (event.data.type) {
        case 'SW_ACTIVATED':
          this.handleServiceWorkerActivated(event.data, isNative);
          break;
        case 'UPDATE_AVAILABLE':
          this.handleUpdateAvailable(event.data, isNative);
          break;
        case 'FORCE_REFRESH':
          this.handleForceRefresh(event.data, isNative);
          break;
        case 'SW_UPDATED':
          this.handleServiceWorkerUpdated(event.data, isNative);
          break;
      }
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[VersionService] NATIVE FIX: Service worker controller changed');
      if (nativeAppService.isNativeApp()) {
        nativeAppService.forceAppRefresh();
      } else {
        this.executeForceRefresh('Service worker updated');
      }
    });
  }

  private handleServiceWorkerActivated(data: any, isNative: boolean): void {
    console.log('[VersionService] NATIVE FIX: Service worker activated:', data);
    
    if (data.forceRefresh || (isNative && data.nativeApp)) {
      toast.success('App Updated!', {
        description: isNative ? 'Native app updated! Refreshing...' : 'New version is active. Refreshing...',
        duration: 2000
      });
      
      setTimeout(() => {
        if (isNative) {
          nativeAppService.forceAppRefresh();
        } else {
          this.executeForceRefresh('Service worker activated');
        }
      }, 2000);
    } else {
      toast.success('App Ready', {
        description: 'Latest version is now active',
        duration: 3000
      });
    }
    
    if (data.version && data.version !== this.currentVersion.version) {
      this.currentVersion.version = data.version;
      this.currentVersion.cacheVersion = data.cacheVersion || this.currentVersion.cacheVersion;
    }
  }

  private handleUpdateAvailable(data: any, isNative: boolean): void {
    console.log('[VersionService] NATIVE FIX: Update available:', data);
    
    toast.info(isNative ? 'Native App Update!' : 'Update Available!', {
      description: isNative ? 'Tap to update your native app' : 'Tap to update to the latest version',
      duration: 0,
      action: {
        label: 'Update Now',
        onClick: () => isNative ? nativeAppService.forceAppRefresh() : this.forceUpdate()
      }
    });
  }

  private handleForceRefresh(data: any, isNative: boolean): void {
    console.log('[VersionService] NATIVE FIX: Force refresh requested:', data);
    
    toast.info(isNative ? 'Updating Native App...' : 'Updating App...', {
      description: isNative ? 'Refreshing native app to latest version' : 'Refreshing to latest version',
      duration: 2000
    });
    
    setTimeout(() => {
      if (isNative) {
        nativeAppService.forceAppRefresh();
      } else {
        this.executeForceRefresh(data.reason || 'Update required');
      }
    }, 2000);
  }

  private handleServiceWorkerUpdated(data: any, isNative: boolean): void {
    console.log('[VersionService] NATIVE FIX: Service worker updated:', data);
    
    toast.success(isNative ? 'Native App Update Downloaded' : 'Update Downloaded', {
      description: isNative ? 'New native app version ready' : 'New version ready to install',
      duration: 5000,
      action: {
        label: 'Activate',
        onClick: () => isNative ? nativeAppService.forceAppRefresh() : this.forceUpdate()
      }
    });
  }

  private executeForceRefresh(reason: string): void {
    console.log(`[VersionService] NATIVE FIX: Executing force refresh: ${reason}`);
    
    if (nativeAppService.isNativeApp()) {
      nativeAppService.forceAppRefresh();
      return;
    }
    
    const url = new URL(window.location.href);
    url.searchParams.set('_refresh', Date.now().toString());
    url.searchParams.set('_v', this.currentVersion.version);
    
    window.location.href = url.toString();
  }

  getCurrentVersion(): AppVersion {
    console.log('[VersionService] NATIVE FIX: getCurrentVersion called', this.currentVersion);
    return { ...this.currentVersion };
  }

  async checkForUpdates(): Promise<UpdateInfo> {
    const now = Date.now();
    const isNative = nativeAppService.isNativeApp();
    const cooldown = isNative ? 5000 : this.updateCheckCooldown; // Shorter cooldown for native
    
    if (now - this.lastUpdateCheck < cooldown) {
      console.log('[VersionService] NATIVE FIX: Update check on cooldown');
      return {
        available: false,
        currentVersion: this.currentVersion.version,
        latestVersion: this.currentVersion.version,
        isNativeApp: isNative
      };
    }

    this.lastUpdateCheck = now;

    try {
      console.log('[VersionService] NATIVE FIX: Checking for updates (native app:', isNative, ')');
      
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (!registration) {
        console.log('[VersionService] NATIVE FIX: No service worker registration');
        return {
          available: false,
          currentVersion: this.currentVersion.version,
          latestVersion: this.currentVersion.version,
          isNativeApp: isNative
        };
      }

      if (registration.waiting) {
        console.log('[VersionService] NATIVE FIX: Waiting service worker found - update available');
        return {
          available: true,
          currentVersion: this.currentVersion.version,
          latestVersion: 'Latest',
          releaseNotes: isNative ? 'Native app improvements and fixes' : 'Comprehensive update fixes and improvements',
          mandatory: false,
          isNativeApp: isNative
        };
      }

      await registration.update();
      
      return new Promise((resolve) => {
        const checkTimeout = setTimeout(() => {
          console.log('[VersionService] NATIVE FIX: Update check timeout');
          resolve({
            available: false,
            currentVersion: this.currentVersion.version,
            latestVersion: this.currentVersion.version,
            isNativeApp: isNative
          });
        }, isNative ? 2000 : 3000); // Shorter timeout for native

        const handleUpdateFound = () => {
          clearTimeout(checkTimeout);
          registration.removeEventListener('updatefound', handleUpdateFound);
          
          const newWorker = registration.installing;
          if (newWorker) {
            console.log('[VersionService] NATIVE FIX: New service worker detected');
            
            const handleStateChange = () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.removeEventListener('statechange', handleStateChange);
                resolve({
                  available: true,
                  currentVersion: this.currentVersion.version,
                  latestVersion: 'Latest',
                  releaseNotes: isNative ? 'New native app version with enhanced features' : 'New version with comprehensive fixes',
                  mandatory: false,
                  isNativeApp: isNative
                });
              }
            };
            
            newWorker.addEventListener('statechange', handleStateChange);
          }
        };
        
        registration.addEventListener('updatefound', handleUpdateFound);
      });

    } catch (error) {
      console.error('[VersionService] NATIVE FIX: Error checking for updates:', error);
      return {
        available: false,
        currentVersion: this.currentVersion.version,
        latestVersion: this.currentVersion.version,
        isNativeApp: isNative
      };
    }
  }

  startAutomaticUpdates(intervalMs: number = 20000) {
    this.stopAutomaticUpdates();
    
    const isNative = nativeAppService.isNativeApp();
    const interval = isNative ? 15000 : intervalMs; // More frequent for native apps
    
    console.log('[VersionService] NATIVE FIX: Starting automatic updates (native:', isNative, 'interval:', interval, ')');
    this.isAutoUpdating = true;
    
    this.updateCheckInterval = setInterval(async () => {
      if (!this.isAutoUpdating) return;
      
      try {
        const updateInfo = await this.checkForUpdates();
        if (updateInfo.available) {
          console.log('[VersionService] NATIVE FIX: Automatic update found');
          
          toast.info(isNative ? 'Native App Update Ready!' : 'Update Ready!', {
            description: isNative ? 'New native app version - tap to update' : 'New version available - tap to update',
            duration: 10000,
            action: {
              label: 'Update Now',
              onClick: () => isNative ? nativeAppService.forceAppRefresh() : this.forceUpdate()
            }
          });
        }
      } catch (error) {
        console.error('[VersionService] NATIVE FIX: Automatic update check failed:', error);
      }
    }, interval);

    setTimeout(async () => {
      if (!this.isAutoUpdating) return;
      
      try {
        const updateInfo = await this.checkForUpdates();
        if (updateInfo.available) {
          console.log('[VersionService] NATIVE FIX: Initial update check found update');
          
          toast.info(isNative ? 'Native App Update Available' : 'Update Available', {
            description: isNative ? 'New native app version ready' : 'New version ready to install',
            duration: 8000,
            action: {
              label: 'Update',
              onClick: () => isNative ? nativeAppService.forceAppRefresh() : this.forceUpdate()
            }
          });
        }
      } catch (error) {
        console.error('[VersionService] NATIVE FIX: Initial update check failed:', error);
      }
    }, 3000);
  }

  stopAutomaticUpdates() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
    
    this.isAutoUpdating = false;
    
    if (nativeAppService.isNativeApp()) {
      nativeAppService.stopNativeUpdateChecking();
    }
    
    console.log('[VersionService] NATIVE FIX: Automatic update checking stopped');
  }

  async clearCache(): Promise<void> {
    try {
      console.log('[VersionService] NATIVE FIX: Clearing cache (native app mode)');
      
      if (nativeAppService.isNativeApp()) {
        await nativeAppService.clearNativeCache();
      } else {
        // ... keep existing code (regular cache clearing logic)
        const cacheNames = await caches.keys();
        const deletionPromises = cacheNames.map(cacheName => {
          console.log('[VersionService] Deleting cache:', cacheName);
          return caches.delete(cacheName);
        });
        
        await Promise.all(deletionPromises);
        
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
            
            setTimeout(resolve, 3000);
          });
        }
        
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
      }
      
      console.log('[VersionService] NATIVE FIX: Cache clearing completed');
    } catch (error) {
      console.error('[VersionService] NATIVE FIX: Error clearing cache:', error);
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
    console.log('[VersionService] NATIVE FIX: Forcing update');
    
    const isNative = nativeAppService.isNativeApp();
    
    if (isNative) {
      await nativeAppService.forceAppRefresh();
      return true;
    }
    
    // ... keep existing code (regular force update logic)
    try {
      toast.info('Updating App...', {
        description: 'Clearing cache and applying updates',
        duration: 3000
      });
      
      await this.clearCache();
      
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration) {
        await registration.update();
        
        if (registration.waiting) {
          console.log('[VersionService] Activating waiting service worker...');
          
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          
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
            
            setTimeout(() => {
              navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
              console.log('[VersionService] Update timeout, forcing refresh anyway...');
              this.executeForceRefresh('Update timeout');
              resolve(true);
            }, 5000);
          });
        } else {
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
      
      setTimeout(() => {
        this.executeForceRefresh('Update error fallback');
      }, 3000);
      
      return false;
    }
  }

  async triggerManualUpdate(): Promise<void> {
    console.log('[VersionService] NATIVE FIX: Manual update triggered');
    
    const isNative = nativeAppService.isNativeApp();
    
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        registration.active?.postMessage({ type: 'CHECK_UPDATE' });
        
        const updateInfo = await this.checkForUpdates();
        
        if (updateInfo.available) {
          toast.success(isNative ? 'Native App Update Found!' : 'Update Found!', {
            description: isNative ? 'New native app version ready' : 'New version is ready to install',
            duration: 5000,
            action: {
              label: 'Install Now',
              onClick: () => isNative ? nativeAppService.forceAppRefresh() : this.forceUpdate()
            }
          });
        } else {
          toast.success('Up to Date', {
            description: isNative ? 'Native app is current' : 'You have the latest version',
            duration: 3000
          });
        }
      }
    } catch (error) {
      console.error('[VersionService] NATIVE FIX: Manual update trigger failed:', error);
      toast.error('Update Check Failed', {
        description: 'Unable to check for updates',
        duration: 3000
      });
    }
  }

  initializeThemeConsistency(): void {
    console.log('[VersionService] NATIVE FIX: Initializing enhanced theme consistency...');
    
    try {
      const root = document.documentElement;
      const body = document.body;
      const isNative = nativeAppService.isNativeApp();
      
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
      
      if (isNative) {
        console.log('[VersionService] NATIVE FIX: Native app detected, applying enhanced compatibility');
        
        body.classList.add('webview-environment', 'native-app-environment');
        
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
        
        const nativeStyle = document.createElement('style');
        nativeStyle.id = 'native-app-enhanced-styles';
        nativeStyle.textContent = `
          .native-app-environment {
            -webkit-user-select: none !important;
            -webkit-touch-callout: none !important;
            -webkit-tap-highlight-color: transparent !important;
            contain: layout style paint !important;
            isolation: isolate !important;
            will-change: transform !important;
          }
          
          .native-app-environment * {
            -webkit-transform: translate3d(0, 0, 0);
            transform: translate3d(0, 0, 0);
            will-change: transform;
          }
          
          .native-cache-bust-${Date.now()} {
            background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB2aWV3Qm94PSIwIDAgMSAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==');
          }
        `;
        document.head.appendChild(nativeStyle);
      }
      
      console.log('[VersionService] NATIVE FIX: Enhanced theme consistency initialized', { 
        storedColorTheme, 
        primaryColor, 
        isNative,
        version: this.currentVersion.version
      });
      
    } catch (error) {
      console.warn('[VersionService] NATIVE FIX: Theme consistency initialization failed:', error);
    }
  }
}

export const versionService = new VersionService();
