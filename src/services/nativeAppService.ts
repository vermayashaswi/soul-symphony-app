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
  }

  private detectNativeApp(): NativeAppInfo {
    const userAgent = navigator.userAgent;
    const buildTimestamp = Date.now();
    
    // Enhanced PWA Builder detection with multiple methods
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
      version: '1.3.0', // Updated version for better PWA Builder support
      buildTimestamp
    };
  }

  private detectPWABuilder(): boolean {
    try {
      // Enhanced PWA Builder detection methods
      const isPWAStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      const hasWebAppManifest = document.querySelector('link[rel="manifest"]') !== null;
      
      // Check for PWA Builder specific signatures
      const userAgent = navigator.userAgent;
      const isPWABuilderUA = userAgent.includes('PWABuilder') || 
                            userAgent.includes('TWA') || // Trusted Web Activity
                            userAgent.includes('WebAPK'); // Android WebAPK
      
      // Check for PWA context indicators
      const isPWAContext = isPWAStandalone || isIOSStandalone;
      
      // Check URL parameters that might indicate native app
      const urlParams = new URLSearchParams(window.location.search);
      const hasNativeParams = urlParams.has('nativeApp') || 
                             urlParams.has('pwabuilder') || 
                             urlParams.has('forceHideBadge');
      
      // Check for native app environment indicators
      const hasNativeEnv = (window as any).AndroidInterface !== undefined ||
                          (window as any).webkit?.messageHandlers !== undefined;
      
      // Check for service worker registration (PWA Builder apps typically have this)
      const hasServiceWorker = 'serviceWorker' in navigator;
      
      // Enhanced detection logic
      const isPWABuilder = isPWABuilderUA || 
                          (isPWAContext && hasWebAppManifest && hasServiceWorker) || 
                          hasNativeParams || 
                          hasNativeEnv;
      
      console.log('[NativeAppService] PWA BUILDER: Enhanced detection results:', {
        isPWAStandalone,
        isIOSStandalone,
        hasWebAppManifest,
        isPWABuilderUA,
        isPWAContext,
        hasNativeParams,
        hasNativeEnv,
        hasServiceWorker,
        finalResult: isPWABuilder
      });
      
      return isPWABuilder;
    } catch (error) {
      console.warn('[NativeAppService] PWA BUILDER: Detection failed:', error);
      return false;
    }
  }

  private initializePWABuilderSupport(): void {
    console.log('[NativeAppService] PWA BUILDER: Initializing enhanced PWA Builder support');
    
    // Set up PWA Builder specific styling and behavior
    document.body.classList.add('pwa-builder-app', 'native-app-environment');
    
    // Enhanced PWA Builder styling injection
    this.injectPWABuilderStyles();
    
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
    
    // Fix background color issues immediately
    this.fixPWABuilderBackgroundColor();
  }

  private injectPWABuilderStyles(): void {
    console.log('[NativeAppService] PWA BUILDER: Injecting enhanced PWA Builder styles');
    
    const styleId = 'pwa-builder-enhanced-styles';
    const existingStyle = document.getElementById(styleId);
    
    if (existingStyle) {
      existingStyle.remove();
    }
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Enhanced PWA Builder Styles for Visual Consistency */
      .pwa-builder-app {
        -webkit-user-select: none !important;
        -webkit-touch-callout: none !important;
        -webkit-tap-highlight-color: transparent !important;
        contain: layout style paint !important;
        isolation: isolate !important;
        background-color: var(--background) !important;
      }
      
      /* Force consistent background colors for PWA Builder */
      .pwa-builder-app,
      .pwa-builder-app body,
      .pwa-builder-app #root,
      .pwa-builder-app .home-container {
        background-color: hsl(var(--background)) !important;
      }
      
      /* Light mode background fix for PWA Builder */
      .pwa-builder-app:not(.dark),
      .pwa-builder-app:not(.dark) body,
      .pwa-builder-app:not(.dark) #root,
      .pwa-builder-app:not(.dark) .home-container {
        background-color: #ffffff !important;
      }
      
      /* Dark mode background fix for PWA Builder */
      .pwa-builder-app.dark,
      .pwa-builder-app.dark body,
      .pwa-builder-app.dark #root,
      .pwa-builder-app.dark .home-container {
        background-color: #0a0a0a !important;
      }
      
      /* Enhanced arrow button positioning for PWA Builder */
      .pwa-builder-app .journal-arrow-button {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) translate3d(0, 0, 0) !important;
        z-index: 40 !important;
        margin: 0 !important;
        padding: 0 !important;
        contain: layout style !important;
        will-change: transform !important;
      }
      
      /* Enhanced button styling for PWA Builder */
      .pwa-builder-app .journal-arrow-button button {
        -webkit-transform: translate3d(0, 0, 0) !important;
        transform: translate3d(0, 0, 0) !important;
        contain: layout style paint !important;
        will-change: transform !important;
        position: relative !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background-color: hsl(var(--primary)) !important;
        color: hsl(var(--primary-foreground)) !important;
        border: none !important;
        outline: none !important;
        border-radius: 9999px !important;
      }
      
      /* Enhanced glow effect for PWA Builder */
      .pwa-builder-app .journal-arrow-button motion-div,
      .pwa-builder-app .journal-arrow-button [data-motion-div] {
        background-color: hsl(var(--primary) / 0.3) !important;
        border-radius: 9999px !important;
        contain: layout style !important;
      }
      
      /* PWA Builder test indicator positioning */
      .pwa-builder-app .pwa-builder-test-indicator {
        z-index: 10000 !important;
        position: fixed !important;
        top: 4px !important;
        right: 4px !important;
      }
      
      /* Ensure consistent theme colors for PWA Builder */
      .pwa-builder-app {
        --primary: 217 91.2% 59.8% !important;
        --primary-foreground: 0 0% 98% !important;
        --background: 0 0% 100% !important;
        --foreground: 240 10% 3.9% !important;
      }
      
      .pwa-builder-app.dark {
        --primary: 217 91.2% 59.8% !important;
        --primary-foreground: 0 0% 98% !important;
        --background: 240 10% 3.9% !important;
        --foreground: 0 0% 98% !important;
      }
      
      /* Cache busting class for PWA Builder */
      .pwa-builder-cache-clear-${Date.now()} {
        background: linear-gradient(45deg, transparent 0%, transparent 100%);
      }
      
      /* Ensure proper viewport handling for PWA Builder */
      .pwa-builder-app .home-container {
        min-height: 100vh !important;
        min-height: 100dvh !important;
        overflow: hidden !important;
        position: relative !important;
      }
      
      /* Fix for any potential z-index issues */
      .pwa-builder-app .journal-arrow-button {
        z-index: 999 !important;
      }
      
      .pwa-builder-app .pwa-builder-test-indicator {
        z-index: 9999 !important;
      }
    `;
    
    document.head.appendChild(style);
  }

  private fixPWABuilderBackgroundColor(): void {
    console.log('[NativeAppService] PWA BUILDER: Fixing background color consistency');
    
    const root = document.documentElement;
    const body = document.body;
    
    // Detect current theme
    const isDark = root.classList.contains('dark') || 
                  (root.classList.contains('system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    // Apply consistent background colors
    if (isDark) {
      root.style.setProperty('--background', '240 10% 3.9%');
      body.style.backgroundColor = '#0a0a0a';
      root.style.backgroundColor = '#0a0a0a';
    } else {
      root.style.setProperty('--background', '0 0% 100%');
      body.style.backgroundColor = '#ffffff';
      root.style.backgroundColor = '#ffffff';
    }
    
    // Force immediate visual update
    body.style.transition = 'none';
    setTimeout(() => {
      body.style.transition = '';
    }, 100);
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

  // Enhanced method to apply PWA Builder fixes at runtime
  applyPWABuilderFixes(): void {
    if (!this.appInfo.isPWABuilder) return;
    
    console.log('[NativeAppService] PWA BUILDER: Applying runtime fixes');
    
    // Re-inject styles
    this.injectPWABuilderStyles();
    
    // Fix background color
    this.fixPWABuilderBackgroundColor();
    
    // Ensure body classes are applied
    document.body.classList.add('pwa-builder-app', 'native-app-environment');
  }

  async clearNativeCache(): Promise<boolean> {
    if (this.appInfo.isPWABuilder) {
      await this.clearPWABuilderCache();
      return true;
    }
    
    try {
      console.log('[NativeAppService] Clearing native app cache...');
      
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[NativeAppService] Cleared cache storages');
      }

      const keysToKeep = ['feelosophy-theme', 'feelosophy-color-theme', 'sb-auth-token'];
      const allKeys = Object.keys(localStorage);
      
      allKeys.forEach(key => {
        if (!keysToKeep.some(keepKey => key.includes(keepKey))) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('[NativeAppService] Cleared localStorage (keeping auth)');
      sessionStorage.clear();
      console.log('[NativeAppService] Cleared sessionStorage');

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
