import { toast } from 'sonner';
import { nativeAppService } from './nativeAppService';

export interface AppVersion {
  version: string;
  buildDate: string;
  features: string[];
  cacheVersion: string;
  nativeAppSupport: boolean;
  pwaBuilderSupport: boolean;
}

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  updateSize?: string;
  releaseNotes?: string;
  mandatory?: boolean;
  isNativeApp?: boolean;
  isPWABuilder?: boolean;
}

class VersionService {
  private currentVersion: AppVersion;
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private isAutoUpdating: boolean = false;
  private lastUpdateCheck: number = 0;
  private updateCheckCooldown: number = 8000;
  private forceRefreshTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.currentVersion = {
      version: '1.2.4', // Incremented for PWA Builder support
      buildDate: new Date().toISOString(),
      features: ['pwaBuilderSupport', 'nativeAppFix', 'webViewCacheClearing', 'enhancedRouting', 'testPlan', 'comprehensiveUpdateFix', 'aggressiveCaching', 'forceRefresh', 'smartChatV2', 'premiumMessaging', 'journalVoicePlayback', 'themeConsistency', 'webViewCompatibility'],
      cacheVersion: 'soulo-cache-v1.2.4', // Updated cache version
      nativeAppSupport: true,
      pwaBuilderSupport: true
    };
    
    this.setupServiceWorkerListeners();
    this.initializeAppSupport();
    
    console.log('[VersionService] PWA BUILDER: Initialized with version', this.currentVersion.version);
    console.log('[VersionService] PWA BUILDER: Support enabled for PWA Builder and native apps');
  }

  private initializeAppSupport(): void {
    const appInfo = nativeAppService.getAppInfo();
    
    console.log('[VersionService] PWA BUILDER: App info detected:', {
      isPWABuilder: appInfo.isPWABuilder,
      isNativeApp: appInfo.isNativeApp,
      platform: appInfo.platform
    });
    
    if (appInfo.isPWABuilder) {
      console.log('[VersionService] PWA BUILDER: Initializing PWA Builder support');
      this.initializePWABuilderSupport();
    } else if (appInfo.isNativeApp) {
      console.log('[VersionService] PWA BUILDER: Initializing standard native app support');
      this.initializeNativeAppSupport();
    }
    
    this.initializeForceRefreshHandling();
  }

  private initializePWABuilderSupport(): void {
    // Ensure proper routing for PWA Builder apps
    nativeAppService.ensureAppRoute();
    
    // Start PWA Builder-specific update checking
    nativeAppService.startNativeUpdateChecking();
    
    // Handle page visibility for PWA Builder apps
    this.initializePWABuilderVisibilityHandling();
    
    // Initialize theme consistency for PWA Builder
    this.initializeThemeConsistency();
  }

  private initializePWABuilderVisibilityHandling(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && nativeAppService.isPWABuilder()) {
        console.log('[VersionService] PWA BUILDER: App became visible, checking updates');
        setTimeout(() => {
          this.checkForUpdates();
        }, 500);
      }
    });

    window.addEventListener('focus', () => {
      if (nativeAppService.isPWABuilder()) {
        console.log('[VersionService] PWA BUILDER: App focused, checking updates');
        setTimeout(() => {
          this.checkForUpdates();
        }, 300);
      }
    });
  }

  private initializeNativeAppSupport(): void {
    nativeAppService.ensureAppRoute();
    nativeAppService.startNativeUpdateChecking();
    this.initializeNativeVisibilityHandling();
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
      console.log('[VersionService] PWA BUILDER: Service worker message:', event.data);
      
      const appInfo = nativeAppService.getAppInfo();
      
      switch (event.data.type) {
        case 'SW_ACTIVATED':
          this.handleServiceWorkerActivated(event.data, appInfo);
          break;
        case 'UPDATE_AVAILABLE':
          this.handleUpdateAvailable(event.data, appInfo);
          break;
        case 'FORCE_REFRESH':
          this.handleForceRefresh(event.data, appInfo);
          break;
        case 'SW_UPDATED':
          this.handleServiceWorkerUpdated(event.data, appInfo);
          break;
      }
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[VersionService] PWA BUILDER: Service worker controller changed');
      const appInfo = nativeAppService.getAppInfo();
      
      if (appInfo.isPWABuilder || appInfo.isNativeApp) {
        nativeAppService.forceAppRefresh();
      } else {
        this.executeForceRefresh('Service worker updated');
      }
    });
  }

  private handleServiceWorkerActivated(data: any, appInfo: any): void {
    console.log('[VersionService] PWA BUILDER: Service worker activated:', data);
    
    const isNativeOrPWA = appInfo.isPWABuilder || appInfo.isNativeApp;
    
    if (data.forceRefresh || (isNativeOrPWA && (data.nativeApp || data.pwaBuilder))) {
      const appType = appInfo.isPWABuilder ? 'PWA Builder app' : 'Native app';
      toast.success('App Updated!', {
        description: `${appType} updated! Refreshing...`,
        duration: 2000
      });
      
      setTimeout(() => {
        if (isNativeOrPWA) {
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

  private handleUpdateAvailable(data: any, appInfo: any): void {
    console.log('[VersionService] PWA BUILDER: Update available:', data);
    
    const appType = appInfo.isPWABuilder ? 'PWA Builder App' : 
                   appInfo.isNativeApp ? 'Native App' : 'App';
    
    toast.info(`${appType} Update!`, {
      description: `Tap to update your ${appType.toLowerCase()}`,
      duration: 0,
      action: {
        label: 'Update Now',
        onClick: () => appInfo.isPWABuilder || appInfo.isNativeApp ? 
                      nativeAppService.forceAppRefresh() : 
                      this.forceUpdate()
      }
    });
  }

  private handleForceRefresh(data: any, appInfo: any): void {
    console.log('[VersionService] PWA BUILDER: Force refresh requested:', data);
    
    const appType = appInfo.isPWABuilder ? 'PWA Builder app' : 
                   appInfo.isNativeApp ? 'Native app' : 'app';
    
    toast.info(`Updating ${appType}...`, {
      description: `Refreshing ${appType} to latest version`,
      duration: 2000
    });
    
    setTimeout(() => {
      if (appInfo.isPWABuilder || appInfo.isNativeApp) {
        nativeAppService.forceAppRefresh();
      } else {
        this.executeForceRefresh(data.reason || 'Update required');
      }
    }, 2000);
  }

  private handleServiceWorkerUpdated(data: any, appInfo: any): void {
    console.log('[VersionService] PWA BUILDER: Service worker updated:', data);
    
    const appType = appInfo.isPWABuilder ? 'PWA Builder App' : 
                   appInfo.isNativeApp ? 'Native App' : 'App';
    
    toast.success(`${appType} Update Downloaded`, {
      description: `New ${appType.toLowerCase()} version ready`,
      duration: 5000,
      action: {
        label: 'Activate',
        onClick: () => appInfo.isPWABuilder || appInfo.isNativeApp ? 
                      nativeAppService.forceAppRefresh() : 
                      this.forceUpdate()
      }
    });
  }

  private executeForceRefresh(reason: string): void {
    console.log(`[VersionService] PWA BUILDER: Executing force refresh: ${reason}`);
    
    const appInfo = nativeAppService.getAppInfo();
    
    if (appInfo.isPWABuilder || appInfo.isNativeApp) {
      nativeAppService.forceAppRefresh();
      return;
    }
    
    const url = new URL(window.location.href);
    url.searchParams.set('_refresh', Date.now().toString());
    url.searchParams.set('_v', this.currentVersion.version);
    
    window.location.href = url.toString();
  }

  getCurrentVersion(): AppVersion {
    console.log('[VersionService] PWA BUILDER: getCurrentVersion called', this.currentVersion);
    return { ...this.currentVersion };
  }

  async checkForUpdates(): Promise<UpdateInfo> {
    const now = Date.now();
    const appInfo = nativeAppService.getAppInfo();
    const cooldown = appInfo.isPWABuilder ? 3000 : // Shorter cooldown for PWA Builder
                    appInfo.isNativeApp ? 5000 : 
                    this.updateCheckCooldown;
    
    if (now - this.lastUpdateCheck < cooldown) {
      console.log('[VersionService] PWA BUILDER: Update check on cooldown');
      return {
        available: false,
        currentVersion: this.currentVersion.version,
        latestVersion: this.currentVersion.version,
        isPWABuilder: appInfo.isPWABuilder,
        isNativeApp: appInfo.isNativeApp
      };
    }

    this.lastUpdateCheck = now;

    try {
      console.log('[VersionService] PWA BUILDER: Checking for updates', {
        isPWABuilder: appInfo.isPWABuilder,
        isNativeApp: appInfo.isNativeApp,
        platform: appInfo.platform
      });
      
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (!registration) {
        console.log('[VersionService] PWA BUILDER: No service worker registration');
        return {
          available: false,
          currentVersion: this.currentVersion.version,
          latestVersion: this.currentVersion.version,
          isPWABuilder: appInfo.isPWABuilder,
          isNativeApp: appInfo.isNativeApp
        };
      }

      if (registration.waiting) {
        console.log('[VersionService] PWA BUILDER: Waiting service worker found - update available');
        return {
          available: true,
          currentVersion: this.currentVersion.version,
          latestVersion: 'Latest',
          releaseNotes: appInfo.isPWABuilder ? 
                       'PWA Builder app improvements and fixes' : 
                       appInfo.isNativeApp ? 
                       'Native app improvements and fixes' : 
                       'Comprehensive update fixes and improvements',
          mandatory: false,
          isPWABuilder: appInfo.isPWABuilder,
          isNativeApp: appInfo.isNativeApp
        };
      }

      await registration.update();
      
      return new Promise((resolve) => {
        const checkTimeout = setTimeout(() => {
          console.log('[VersionService] PWA BUILDER: Update check timeout');
          resolve({
            available: false,
            currentVersion: this.currentVersion.version,
            latestVersion: this.currentVersion.version,
            isPWABuilder: appInfo.isPWABuilder,
            isNativeApp: appInfo.isNativeApp
          });
        }, appInfo.isPWABuilder ? 1500 : appInfo.isNativeApp ? 2000 : 3000);

        const handleUpdateFound = () => {
          clearTimeout(checkTimeout);
          registration.removeEventListener('updatefound', handleUpdateFound);
          
          const newWorker = registration.installing;
          if (newWorker) {
            console.log('[VersionService] PWA BUILDER: New service worker detected');
            
            const handleStateChange = () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.removeEventListener('statechange', handleStateChange);
                resolve({
                  available: true,
                  currentVersion: this.currentVersion.version,
                  latestVersion: 'Latest',
                  releaseNotes: appInfo.isPWABuilder ? 
                               'New PWA Builder app version with enhanced features' : 
                               appInfo.isNativeApp ? 
                               'New native app version with enhanced features' : 
                               'New version with comprehensive fixes',
                  mandatory: false,
                  isPWABuilder: appInfo.isPWABuilder,
                  isNativeApp: appInfo.isNativeApp
                });
              }
            };
            
            newWorker.addEventListener('statechange', handleStateChange);
          }
        };
        
        registration.addEventListener('updatefound', handleUpdateFound);
      });

    } catch (error) {
      console.error('[VersionService] PWA BUILDER: Error checking for updates:', error);
      return {
        available: false,
        currentVersion: this.currentVersion.version,
        latestVersion: this.currentVersion.version,
        isPWABuilder: appInfo.isPWABuilder,
        isNativeApp: appInfo.isNativeApp
      };
    }
  }

  startAutomaticUpdates(intervalMs: number = 20000) {
    this.stopAutomaticUpdates();
    
    const appInfo = nativeAppService.getAppInfo();
    const interval = appInfo.isPWABuilder ? 8000 : // Most frequent for PWA Builder
                    appInfo.isNativeApp ? 15000 : 
                    intervalMs;
    
    console.log('[VersionService] PWA BUILDER: Starting automatic updates', {
      isPWABuilder: appInfo.isPWABuilder,
      isNativeApp: appInfo.isNativeApp,
      interval
    });
    
    this.isAutoUpdating = true;
    
    this.updateCheckInterval = setInterval(async () => {
      if (!this.isAutoUpdating) return;
      
      try {
        const updateInfo = await this.checkForUpdates();
        if (updateInfo.available) {
          console.log('[VersionService] PWA BUILDER: Automatic update found');
          
          const appType = appInfo.isPWABuilder ? 'PWA Builder App' : 
                         appInfo.isNativeApp ? 'Native App' : 'App';
          
          toast.info(`${appType} Update Ready!`, {
            description: `New ${appType.toLowerCase()} version - tap to update`,
            duration: 10000,
            action: {
              label: 'Update Now',
              onClick: () => appInfo.isPWABuilder || appInfo.isNativeApp ? 
                            nativeAppService.forceAppRefresh() : 
                            this.forceUpdate()
            }
          });
        }
      } catch (error) {
        console.error('[VersionService] PWA BUILDER: Automatic update check failed:', error);
      }
    }, interval);

    setTimeout(async () => {
      if (!this.isAutoUpdating) return;
      
      try {
        const updateInfo = await this.checkForUpdates();
        if (updateInfo.available) {
          console.log('[VersionService] PWA BUILDER: Initial update check found update');
          
          const appType = appInfo.isPWABuilder ? 'PWA Builder App' : 
                         appInfo.isNativeApp ? 'Native App' : 'App';
          
          toast.info(`${appType} Update Available`, {
            description: `New ${appType.toLowerCase()} version ready to install`,
            duration: 8000,
            action: {
              label: 'Update',
              onClick: () => appInfo.isPWABuilder || appInfo.isNativeApp ? 
                            nativeAppService.forceAppRefresh() : 
                            this.forceUpdate()
            }
          });
        }
      } catch (error) {
        console.error('[VersionService] PWA BUILDER: Initial update check failed:', error);
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
    
    console.log('[VersionService] PWA BUILDER: Automatic update checking stopped');
  }

  async clearCache(): Promise<void> {
    try {
      console.log('[VersionService] PWA BUILDER: Clearing cache');
      
      const appInfo = nativeAppService.getAppInfo();
      
      if (appInfo.isPWABuilder || appInfo.isNativeApp) {
        await nativeAppService.clearNativeCache();
      } else {
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
      
      console.log('[VersionService] PWA BUILDER: Cache clearing completed');
    } catch (error) {
      console.error('[VersionService] PWA BUILDER: Error clearing cache:', error);
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
    console.log('[VersionService] PWA BUILDER: Forcing update');
    
    const appInfo = nativeAppService.getAppInfo();
    
    if (appInfo.isPWABuilder || appInfo.isNativeApp) {
      await nativeAppService.forceAppRefresh();
      return true;
    }
    
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
    console.log('[VersionService] PWA BUILDER: Manual update triggered');
    
    const appInfo = nativeAppService.getAppInfo();
    
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        registration.active?.postMessage({ type: 'CHECK_UPDATE' });
        
        const updateInfo = await this.checkForUpdates();
        
        if (updateInfo.available) {
          const appType = appInfo.isPWABuilder ? 'PWA Builder App' : 
                         appInfo.isNativeApp ? 'Native App' : 'App';
          
          toast.success(`${appType} Update Found!`, {
            description: `New ${appType.toLowerCase()} version ready`,
            duration: 5000,
            action: {
              label: 'Install Now',
              onClick: () => appInfo.isPWABuilder || appInfo.isNativeApp ? 
                            nativeAppService.forceAppRefresh() : 
                            this.forceUpdate()
            }
          });
        } else {
          const appType = appInfo.isPWABuilder ? 'PWA Builder app' : 
                         appInfo.isNativeApp ? 'Native app' : 'App';
          
          toast.success('Up to Date', {
            description: `${appType} is current`,
            duration: 3000
          });
        }
      }
    } catch (error) {
      console.error('[VersionService] PWA BUILDER: Manual update trigger failed:', error);
      toast.error('Update Check Failed', {
        description: 'Unable to check for updates',
        duration: 3000
      });
    }
  }

  initializeThemeConsistency(): void {
    console.log('[VersionService] PWA BUILDER: Initializing enhanced theme consistency...');
    
    try {
      const root = document.documentElement;
      const body = document.body;
      const appInfo = nativeAppService.getAppInfo();
      
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
      
      if (appInfo.isPWABuilder) {
        console.log('[VersionService] PWA BUILDER: Applying PWA Builder specific theme styling');
        
        body.classList.add('pwa-builder-app', 'native-app-environment');
        
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
        
        const pwaBuilderStyle = document.createElement('style');
        pwaBuilderStyle.id = 'pwa-builder-enhanced-styles';
        pwaBuilderStyle.textContent = `
          .pwa-builder-app {
            -webkit-user-select: none !important;
            -webkit-touch-callout: none !important;
            -webkit-tap-highlight-color: transparent !important;
            contain: layout style paint !important;
            isolation: isolate !important;
            will-change: transform !important;
          }
          
          .pwa-builder-app * {
            -webkit-transform: translate3d(0, 0, 0);
            transform: translate3d(0, 0, 0);
            will-change: transform;
          }
          
          .pwa-builder-cache-bust-${Date.now()} {
            background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB2aWV3Qm94PSIwIDAgMSAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==');
          }
        `;
        document.head.appendChild(pwaBuilderStyle);
      } else if (appInfo.isNativeApp) {
        console.log('[VersionService] PWA BUILDER: Native app detected, applying enhanced compatibility');
        
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
      
      console.log('[VersionService] PWA BUILDER: Enhanced theme consistency initialized', { 
        storedColorTheme, 
        primaryColor, 
        isPWABuilder: appInfo.isPWABuilder,
        isNativeApp: appInfo.isNativeApp,
        version: this.currentVersion.version
      });
      
    } catch (error) {
      console.warn('[VersionService] PWA BUILDER: Theme consistency initialization failed:', error);
    }
  }
}

export const versionService = new VersionService();
