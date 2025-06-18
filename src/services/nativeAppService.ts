import { toast } from 'sonner';

export interface NativeAppInfo {
  isNativeApp: boolean;
  isWebView: boolean;
  isPWABuilder: boolean;
  userAgent: string;
  platform: 'ios' | 'android' | 'web';
  version: string;
  buildTimestamp: number;
}

class NativeAppService {
  private appInfo: NativeAppInfo;
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private lastUpdateCheck: number = 0;
  private isUpdating: boolean = false;

  constructor() {
    this.appInfo = this.detectNativeApp();
    console.log('[NativeAppService] PWA BUILDER: Initialized:', this.appInfo);
    
    if (this.appInfo.isPWABuilder) {
      this.initializePWABuilderSupport();
    }
    
    // Initialize theme consistency for native apps
    this.initializeThemeConsistency();
  }

  private detectNativeApp(): NativeAppInfo {
    const userAgent = navigator.userAgent;
    const buildTimestamp = Date.now();
    
    // Enhanced PWA Builder detection
    const isPWABuilder = this.detectPWABuilder();
    const isNativeApp = isPWABuilder || 
                       userAgent.includes('SouloNativeApp') || 
                       userAgent.includes('Capacitor') ||
                       window.location.protocol === 'capacitor:' ||
                       (window as any).Capacitor !== undefined;
    
    const isWebView = userAgent.includes('wv') || 
                     userAgent.includes('WebView') || 
                     window.location.protocol === 'file:' ||
                     (window as any).AndroidInterface !== undefined ||
                     document.URL.indexOf('http://') === -1 && document.URL.indexOf('https://') === -1;
    
    let platform: 'ios' | 'android' | 'web' = 'web';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      platform = 'ios';
    } else if (userAgent.includes('Android')) {
      platform = 'android';
    }

    return {
      isNativeApp,
      isWebView,
      isPWABuilder,
      userAgent,
      platform,
      version: '1.2.5', // Incremented for enhanced theme support
      buildTimestamp
    };
  }

  private detectPWABuilder(): boolean {
    try {
      // PWA Builder detection methods
      const isPWAStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      const hasWebAppManifest = document.querySelector('link[rel="manifest"]') !== null;
      
      // Check for PWA Builder specific signatures
      const userAgent = navigator.userAgent;
      const isPWABuilderUA = userAgent.includes('PWABuilder') || 
                            userAgent.includes('TWA') || // Trusted Web Activity
                            userAgent.includes('WebAPK'); // Android WebAPK
      
      // Check for PWA context
      const isPWAContext = isPWAStandalone || isIOSStandalone;
      
      // Check URL parameters that might indicate native app
      const urlParams = new URLSearchParams(window.location.search);
      const hasNativeParams = urlParams.has('nativeApp') || urlParams.has('pwabuilder');
      
      // Check for native app environment indicators
      const hasNativeEnv = (window as any).AndroidInterface !== undefined ||
                          (window as any).webkit?.messageHandlers !== undefined;
      
      const isPWABuilder = isPWABuilderUA || 
                          (isPWAContext && hasWebAppManifest) || 
                          hasNativeParams || 
                          hasNativeEnv;
      
      console.log('[NativeAppService] PWA BUILDER: Detection results:', {
        isPWAStandalone,
        isIOSStandalone,
        hasWebAppManifest,
        isPWABuilderUA,
        isPWAContext,
        hasNativeParams,
        hasNativeEnv,
        finalResult: isPWABuilder
      });
      
      return isPWABuilder;
    } catch (error) {
      console.warn('[NativeAppService] PWA BUILDER: Detection failed:', error);
      return false;
    }
  }

  private initializeThemeConsistency(): void {
    if (!this.isAppRoute()) return;
    
    console.log('[NativeAppService] Initializing theme consistency for native app');
    
    // Set up theme reapplication when app becomes visible
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isAppRoute()) {
        console.log('[NativeAppService] App became visible, checking theme consistency');
        setTimeout(() => this.validateAndReapplyTheme(), 1000);
      }
    });
    
    // Monitor for route changes to app routes
    let lastPathname = window.location.pathname;
    const checkRouteChange = () => {
      const currentPathname = window.location.pathname;
      if (currentPathname !== lastPathname) {
        lastPathname = currentPathname;
        if (this.isAppRoute()) {
          console.log('[NativeAppService] App route detected, ensuring theme consistency');
          setTimeout(() => this.validateAndReapplyTheme(), 500);
        }
      }
    };
    
    // Check for route changes periodically
    setInterval(checkRouteChange, 2000);
  }

  private isAppRoute(): boolean {
    try {
      return window.location.pathname.startsWith('/app');
    } catch {
      return false;
    }
  }

  private validateAndReapplyTheme(): void {
    if (!this.isAppRoute() || !(this.isNativeApp() || this.isWebView())) return;
    
    try {
      console.log('[NativeAppService] Validating theme consistency...');
      
      // Get expected theme from localStorage
      const expectedColorTheme = localStorage.getItem('feelosophy-color-theme') || 'Default';
      const expectedCustomColor = localStorage.getItem('feelosophy-custom-color') || '#3b82f6';
      
      // Get expected color hex
      let expectedHex = '#3b82f6'; // Default
      switch (expectedColorTheme) {
        case 'Calm': expectedHex = '#8b5cf6'; break;
        case 'Soothing': expectedHex = '#FFDEE2'; break;
        case 'Energy': expectedHex = '#f59e0b'; break;
        case 'Focus': expectedHex = '#10b981'; break;
        case 'Custom': expectedHex = expectedCustomColor; break;
      }
      
      // Check if theme is applied correctly
      const root = document.documentElement;
      const appliedColor = root.style.getPropertyValue('--color-theme');
      
      if (appliedColor !== expectedHex) {
        console.log('[NativeAppService] Theme inconsistency detected, reapplying...', {
          expected: expectedHex,
          applied: appliedColor
        });
        
        // Force theme reapplication
        this.forceThemeReapplication(expectedColorTheme, expectedCustomColor, expectedHex);
      } else {
        console.log('[NativeAppService] Theme consistency validated successfully');
      }
    } catch (error) {
      console.error('[NativeAppService] Theme validation failed:', error);
    }
  }

  private forceThemeReapplication(colorTheme: string, customColor: string, expectedHex: string): void {
    try {
      const root = document.documentElement;
      const body = document.body;
      
      // Force color theme variables
      root.style.setProperty('--color-theme', expectedHex, 'important');
      root.style.setProperty('--primary', this.convertHexToHsl(expectedHex), 'important');
      root.style.setProperty('--ring', this.convertHexToHsl(expectedHex), 'important');
      
      // Mark as app route
      body.setAttribute('data-app-route', 'true');
      
      // Add WebView class if needed
      if (this.isWebView()) {
        body.classList.add('webview-environment');
        
        // Create WebView-specific style injection
        let webViewStyle = document.getElementById('native-theme-override');
        if (!webViewStyle) {
          webViewStyle = document.createElement('style');
          webViewStyle.id = 'native-theme-override';
          document.head.appendChild(webViewStyle);
        }
        
        webViewStyle.textContent = `
          /* Native app theme override */
          body[data-app-route="true"] .text-theme,
          body[data-app-route="true"] .text-theme-color,
          body[data-app-route="true"] .theme-text { 
            color: ${expectedHex} !important; 
          }
          
          body[data-app-route="true"] .bg-theme,
          body[data-app-route="true"] .bg-theme-color,
          body[data-app-route="true"] .theme-bg { 
            background-color: ${expectedHex} !important; 
          }
          
          body[data-app-route="true"] .border-theme,
          body[data-app-route="true"] .border-theme-color,
          body[data-app-route="true"] .theme-border { 
            border-color: ${expectedHex} !important; 
          }
          
          body[data-app-route="true"] .bg-primary {
            background-color: ${expectedHex} !important;
          }
          
          body[data-app-route="true"] .text-primary {
            color: ${expectedHex} !important;
          }
          
          body[data-app-route="true"] .border-primary {
            border-color: ${expectedHex} !important;
          }
        `;
      }
      
      console.log('[NativeAppService] Theme reapplication completed for:', expectedHex);
    } catch (error) {
      console.error('[NativeAppService] Theme reapplication failed:', error);
    }
  }

  private convertHexToHsl(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '217 91.2% 59.8%'; // Default blue
    
    const r = parseInt(result[1], 16) / 255;
    const g = parseInt(result[2], 16) / 255;
    const b = parseInt(result[3], 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      
      h /= 6;
    }
    
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  }

  private initializePWABuilderSupport(): void {
    console.log('[NativeAppService] PWA BUILDER: Initializing PWA Builder support');
    
    // Set up native app specific styling and behavior
    document.body.classList.add('pwa-builder-app', 'native-app-environment');
    
    // Store build timestamp for cache busting
    localStorage.setItem('pwa-builder-build-timestamp', this.appInfo.buildTimestamp.toString());
    
    // Initialize update checking for PWA Builder
    this.startPWABuilderUpdateChecking();
    
    // Handle visibility changes for PWA Builder apps
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[NativeAppService] PWA BUILDER: App became visible, checking for updates');
        setTimeout(() => this.checkForPWABuilderUpdates(), 1000);
      }
    });
    
    // Ensure proper routing for PWA Builder apps
    this.ensurePWABuilderRoute();
  }

  private ensurePWABuilderRoute(): void {
    const currentPath = window.location.pathname;
    
    // For PWA Builder apps, redirect to app routes if on root
    if (currentPath === '/' || !currentPath.startsWith('/app')) {
      console.log('[NativeAppService] PWA BUILDER: Redirecting to app route');
      
      // Use history.replaceState to avoid navigation issues
      const newUrl = '/app' + (currentPath === '/' ? '/home' : currentPath);
      window.history.replaceState(null, '', newUrl);
      
      // Trigger a page reload to ensure proper app initialization
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  }

  private startPWABuilderUpdateChecking(): void {
    console.log('[NativeAppService] PWA BUILDER: Starting update checking');
    
    // More frequent checks for PWA Builder apps
    this.updateCheckInterval = setInterval(() => {
      this.checkForPWABuilderUpdates();
    }, 10000); // Every 10 seconds
    
    // Initial check after a delay
    setTimeout(() => {
      this.checkForPWABuilderUpdates();
    }, 3000);
  }

  private async checkForPWABuilderUpdates(): Promise<void> {
    if (this.isUpdating) return;
    
    const now = Date.now();
    if (now - this.lastUpdateCheck < 8000) return; // Cooldown
    
    this.lastUpdateCheck = now;
    
    try {
      console.log('[NativeAppService] PWA BUILDER: Checking for updates');
      
      // Check service worker for updates
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        
        if (registration.waiting) {
          console.log('[NativeAppService] PWA BUILDER: Update available');
          this.handlePWABuilderUpdate();
        }
      }
      
      // Check for version changes by comparing timestamps
      const storedTimestamp = localStorage.getItem('pwa-builder-build-timestamp');
      const currentTimestamp = this.appInfo.buildTimestamp.toString();
      
      if (storedTimestamp && storedTimestamp !== currentTimestamp) {
        console.log('[NativeAppService] PWA BUILDER: Version change detected');
        this.handlePWABuilderUpdate();
      }
      
    } catch (error) {
      console.error('[NativeAppService] PWA BUILDER: Update check failed:', error);
    }
  }

  private handlePWABuilderUpdate(): void {
    if (this.isUpdating) return;
    
    console.log('[NativeAppService] PWA BUILDER: Handling update');
    
    toast.info('App Update Available!', {
      description: 'New version ready - tap to update',
      duration: 0, // Don't auto-dismiss
      action: {
        label: 'Update Now',
        onClick: () => this.executePWABuilderUpdate()
      }
    });
  }

  private async executePWABuilderUpdate(): Promise<void> {
    if (this.isUpdating) return;
    
    this.isUpdating = true;
    
    try {
      console.log('[NativeAppService] PWA BUILDER: Executing update');
      
      toast.info('Updating App...', {
        description: 'Please wait while we update to the latest version',
        duration: 3000
      });
      
      // Clear PWA Builder specific caches
      await this.clearPWABuilderCache();
      
      // Update build timestamp
      localStorage.setItem('pwa-builder-build-timestamp', Date.now().toString());
      
      // Force reload with cache busting
      const url = new URL(window.location.href);
      url.searchParams.set('_pwaUpdate', Date.now().toString());
      url.searchParams.set('_v', this.appInfo.version);
      url.searchParams.set('_clearCache', 'true');
      
      setTimeout(() => {
        window.location.replace(url.toString());
      }, 2000);
      
    } catch (error) {
      console.error('[NativeAppService] PWA BUILDER: Update failed:', error);
      this.isUpdating = false;
      
      toast.error('Update Failed', {
        description: 'Please try refreshing the app manually',
        duration: 5000
      });
    }
  }

  private async clearPWABuilderCache(): Promise<void> {
    try {
      console.log('[NativeAppService] PWA BUILDER: Clearing cache');
      
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Clear localStorage except essential items
      const keysToKeep = [
        'feelosophy-theme', 
        'feelosophy-color-theme', 
        'feelosophy-custom-color',
        'sb-auth-token',
        'pwa-builder-build-timestamp'
      ];
      
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (!keysToKeep.some(keepKey => key.includes(keepKey))) {
          localStorage.removeItem(key);
        }
      });
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      console.log('[NativeAppService] PWA BUILDER: Cache cleared successfully');
    } catch (error) {
      console.error('[NativeAppService] PWA BUILDER: Cache clearing failed:', error);
    }
  }

  // Public methods
  isNativeApp(): boolean {
    return this.appInfo.isNativeApp;
  }

  isPWABuilder(): boolean {
    return this.appInfo.isPWABuilder;
  }

  isWebView(): boolean {
    return this.appInfo.isWebView;
  }

  getPlatform(): 'ios' | 'android' | 'web' {
    return this.appInfo.platform;
  }

  getAppInfo(): NativeAppInfo {
    return { ...this.appInfo };
  }

  async clearNativeCache(): Promise<boolean> {
    if (this.appInfo.isPWABuilder) {
      await this.clearPWABuilderCache();
      // Trigger theme reapplication after cache clear
      setTimeout(() => this.validateAndReapplyTheme(), 1000);
      return true;
    }
    
    try {
      console.log('[NativeAppService] Clearing native app cache...');
      
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[NativeAppService] Cleared cache storages');
      }

      const keysToKeep = ['feelosophy-theme', 'feelosophy-color-theme', 'feelosophy-custom-color', 'sb-auth-token'];
      const allKeys = Object.keys(localStorage);
      
      allKeys.forEach(key => {
        if (!keysToKeep.some(keepKey => key.includes(keepKey))) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('[NativeAppService] Cleared localStorage (keeping auth and theme)');
      sessionStorage.clear();
      console.log('[NativeAppService] Cleared sessionStorage');

      // Trigger theme reapplication after cache clear
      setTimeout(() => this.validateAndReapplyTheme(), 1000);

      return true;
    } catch (error) {
      console.error('[NativeAppService] Cache clearing failed:', error);
      return false;
    }
  }

  async forceAppRefresh(): Promise<void> {
    if (this.appInfo.isPWABuilder) {
      await this.executePWABuilderUpdate();
      return;
    }
    
    console.log('[NativeAppService] Forcing app refresh for native app');
    
    try {
      await this.clearNativeCache();
      
      const url = new URL(window.location.href);
      url.searchParams.set('_nativeRefresh', Date.now().toString());
      url.searchParams.set('_v', this.appInfo.version);
      url.searchParams.set('_clearCache', 'true');
      
      toast.info('Updating App...', {
        description: 'Refreshing to latest version',
        duration: 2000
      });
      
      setTimeout(() => {
        if (this.isNativeApp()) {
          window.location.replace(url.toString());
        } else {
          window.location.href = url.toString();
        }
      }, 2000);
      
    } catch (error) {
      console.error('[NativeAppService] Force refresh failed:', error);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }

  startNativeUpdateChecking(): void {
    if (this.appInfo.isPWABuilder) {
      return;
    }
    
    if (!this.isNativeApp()) return;
    
    console.log('[NativeAppService] Starting native app update checking...');
    
    this.updateCheckInterval = setInterval(() => {
      this.checkForNativeUpdates();
    }, 15000);
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => {
          this.checkForNativeUpdates();
        }, 1000);
      }
    });
  }

  private async checkForNativeUpdates(): Promise<void> {
    if (!this.isNativeApp()) return;
    
    try {
      console.log('[NativeAppService] Checking for native app updates...');
      
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration) {
        await registration.update();
        
        if (registration.waiting) {
          console.log('[NativeAppService] Update available for native app');
          
          toast.info('App Update Available!', {
            description: 'Tap to update to the latest version',
            duration: 0,
            action: {
              label: 'Update Now',
              onClick: () => this.forceAppRefresh()
            }
          });
        }
      }
      
    } catch (error) {
      console.error('[NativeAppService] Native update check failed:', error);
    }
  }

  stopNativeUpdateChecking(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }

  ensureAppRoute(): void {
    if (this.appInfo.isPWABuilder) {
      this.ensurePWABuilderRoute();
      return;
    }
    
    if (!this.isNativeApp()) return;
    
    const currentPath = window.location.pathname;
    
    if (currentPath === '/' || !currentPath.startsWith('/app')) {
      console.log('[NativeAppService] Redirecting native app to /app route');
      
      const newUrl = '/app' + (currentPath === '/' ? '/home' : currentPath);
      window.history.replaceState(null, '', newUrl);
    }
  }
}

export const nativeAppService = new NativeAppService();
