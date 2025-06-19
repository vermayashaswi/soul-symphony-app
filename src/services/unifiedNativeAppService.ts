import { toast } from 'sonner';

export interface UnifiedNativeAppInfo {
  isNativeApp: boolean;
  isWebView: boolean;
  isPWABuilder: boolean;
  userAgent: string;
  platform: 'ios' | 'android' | 'web';
  version: string;
  buildTimestamp: number;
  environment: 'native' | 'pwa' | 'web';
}

class UnifiedNativeAppService {
  private appInfo: UnifiedNativeAppInfo;
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private themeValidationInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor() {
    this.appInfo = this.detectEnvironment();
    console.log('[UnifiedNativeApp] Environment detected:', this.appInfo);
  }

  private detectEnvironment(): UnifiedNativeAppInfo {
    const userAgent = navigator.userAgent;
    const currentTime = Date.now();
    
    // Simplified WebView detection
    const isWebView = this.isWebViewEnvironment();
    
    // Simplified PWA Builder detection
    const isPWABuilder = this.isPWABuilderEnvironment();
    
    // Native app detection
    const isNativeApp = isPWABuilder || isWebView || this.hasNativeInterfaces();
    
    // Platform detection
    let platform: 'ios' | 'android' | 'web' = 'web';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      platform = 'ios';
    } else if (userAgent.includes('Android')) {
      platform = 'android';
    }

    // Environment classification
    let environment: 'native' | 'pwa' | 'web' = 'web';
    if (isPWABuilder) {
      environment = 'pwa';
    } else if (isNativeApp) {
      environment = 'native';
    }

    return {
      isNativeApp,
      isWebView,
      isPWABuilder,
      userAgent,
      platform,
      version: '2.1.0', // Unified version
      buildTimestamp: currentTime,
      environment
    };
  }

  private isWebViewEnvironment(): boolean {
    try {
      const userAgent = navigator.userAgent;
      return userAgent.includes('wv') || 
             userAgent.includes('WebView') || 
             window.location.protocol === 'file:' ||
             document.URL.indexOf('http://') === -1 && document.URL.indexOf('https://') === -1;
    } catch {
      return false;
    }
  }

  private isPWABuilderEnvironment(): boolean {
    try {
      const isPWAStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const userAgent = navigator.userAgent;
      const isPWABuilderUA = userAgent.includes('PWABuilder') || 
                            userAgent.includes('TWA') || 
                            userAgent.includes('WebAPK');
      
      return isPWABuilderUA || (isPWAStandalone && this.hasNativeInterfaces());
    } catch {
      return false;
    }
  }

  private hasNativeInterfaces(): boolean {
    try {
      return (window as any).AndroidInterface !== undefined ||
             (window as any).webkit?.messageHandlers !== undefined;
    } catch {
      return false;
    }
  }

  private isAppRoute(): boolean {
    try {
      return window.location.pathname.startsWith('/app');
    } catch {
      return false;
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('[UnifiedNativeApp] Initializing unified native app service');
    
    if (this.isAppRoute() && this.appInfo.isNativeApp) {
      await this.initializeNativeAppFeatures();
      this.setupThemeConsistency();
      this.startUpdateChecking();
      this.ensureProperRouting();
    }
    
    this.isInitialized = true;
  }

  private async initializeNativeAppFeatures(): Promise<void> {
    console.log('[UnifiedNativeApp] Initializing native app features');
    
    // Set body attributes for native app
    document.body.setAttribute('data-app-route', 'true');
    document.body.setAttribute('data-native-app', this.appInfo.environment);
    document.body.classList.add('native-app-environment');
    
    // Apply immediate theme correction
    await this.applyNativeTheme();
    
    // Handle visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isAppRoute()) {
        console.log('[UnifiedNativeApp] App became visible, revalidating theme');
        setTimeout(() => this.validateAndCorrectTheme(), 1000);
      }
    });
  }

  private async applyNativeTheme(): Promise<void> {
    if (!this.isAppRoute()) return;
    
    try {
      console.log('[UnifiedNativeApp] Applying native theme');
      
      // Get theme from localStorage
      const colorTheme = localStorage.getItem('feelosophy-color-theme') || 'Default';
      const customColor = localStorage.getItem('feelosophy-custom-color') || '#3b82f6';
      const themeMode = localStorage.getItem('feelosophy-theme') || 'system';
      
      // Calculate theme color
      const themeHex = this.getThemeHex(colorTheme, customColor);
      
      // Apply to CSS variables
      const root = document.documentElement;
      root.style.setProperty('--color-theme', themeHex, 'important');
      root.style.setProperty('--primary', this.convertHexToHsl(themeHex), 'important');
      root.style.setProperty('--ring', this.convertHexToHsl(themeHex), 'important');
      
      // Apply system theme
      const systemTheme = this.getSystemTheme();
      const appliedTheme = themeMode === 'system' ? systemTheme : themeMode;
      root.classList.remove('light', 'dark');
      root.classList.add(appliedTheme);
      
      // Create native-specific styling
      this.injectNativeStyles(themeHex, appliedTheme);
      
      console.log('[UnifiedNativeApp] Native theme applied:', { themeHex, appliedTheme });
      
    } catch (error) {
      console.error('[UnifiedNativeApp] Theme application failed:', error);
    }
  }

  private getThemeHex(colorTheme: string, customColor: string): string {
    switch (colorTheme) {
      case 'Default': return '#3b82f6';
      case 'Calm': return '#8b5cf6';
      case 'Soothing': return '#FFDEE2';
      case 'Energy': return '#f59e0b';
      case 'Focus': return '#10b981';
      case 'Custom': return customColor || '#3b82f6';
      default: return '#3b82f6';
    }
  }

  private getSystemTheme(): 'light' | 'dark' {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'light';
    } catch {
      return 'light';
    }
  }

  private convertHexToHsl(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '217 91.2% 59.8%';
    
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

  private injectNativeStyles(themeHex: string, appliedTheme: string): void {
    let nativeStyle = document.getElementById('unified-native-styles');
    if (!nativeStyle) {
      nativeStyle = document.createElement('style');
      nativeStyle.id = 'unified-native-styles';
      document.head.appendChild(nativeStyle);
    }
    
    const backgroundColor = appliedTheme === 'light' ? '#ffffff' : '#0a0a0a';
    const textColor = appliedTheme === 'light' ? '#000000' : '#ffffff';
    
    nativeStyle.textContent = `
      /* Unified Native App Styles */
      body[data-native-app] {
        background-color: ${backgroundColor} !important;
        color: ${textColor} !important;
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
      }
      
      /* Theme Color Applications */
      body[data-native-app] .text-theme,
      body[data-native-app] .text-theme-color,
      body[data-native-app] .text-primary { 
        color: ${themeHex} !important; 
      }
      
      body[data-native-app] .bg-theme,
      body[data-native-app] .bg-theme-color,
      body[data-native-app] .bg-primary { 
        background-color: ${themeHex} !important; 
      }
      
      body[data-native-app] .border-theme,
      body[data-native-app] .border-theme-color,
      body[data-native-app] .border-primary { 
        border-color: ${themeHex} !important; 
      }
      
      /* Button and Interactive Elements */
      body[data-native-app] button[class*="primary"],
      body[data-native-app] .btn-primary {
        background-color: ${themeHex} !important;
        border-color: ${themeHex} !important;
        color: white !important;
      }
      
      /* Icon and SVG Colors */
      body[data-native-app] .stroke-theme,
      body[data-native-app] .fill-theme { 
        stroke: ${themeHex} !important;
        fill: ${themeHex} !important; 
      }
      
      /* Enhanced contrast for readability */
      body[data-native-app] h1,
      body[data-native-app] h2,
      body[data-native-app] h3 {
        color: ${themeHex} !important;
        font-weight: 600 !important;
      }
      
      /* WebView specific resets */
      body[data-native-app] * {
        -webkit-appearance: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }
      
      body[data-native-app] input,
      body[data-native-app] button,
      body[data-native-app] select {
        -webkit-appearance: none !important;
        background: transparent !important;
        border-radius: 8px !important;
      }
    `;
  }

  private setupThemeConsistency(): void {
    // Validate theme every 5 seconds for the first minute
    this.themeValidationInterval = setInterval(() => {
      this.validateAndCorrectTheme();
    }, 5000);
    
    // Stop frequent validation after 1 minute
    setTimeout(() => {
      if (this.themeValidationInterval) {
        clearInterval(this.themeValidationInterval);
        this.themeValidationInterval = null;
      }
    }, 60000);
  }

  private validateAndCorrectTheme(): void {
    if (!this.isAppRoute() || !this.appInfo.isNativeApp) return;
    
    try {
      const expectedColorTheme = localStorage.getItem('feelosophy-color-theme') || 'Default';
      const expectedCustomColor = localStorage.getItem('feelosophy-custom-color') || '#3b82f6';
      const expectedHex = this.getThemeHex(expectedColorTheme, expectedCustomColor);
      
      const root = document.documentElement;
      const appliedColor = root.style.getPropertyValue('--color-theme');
      
      if (appliedColor !== expectedHex) {
        console.log('[UnifiedNativeApp] Theme inconsistency detected, correcting...', {
          expected: expectedHex,
          applied: appliedColor
        });
        
        this.applyNativeTheme();
      }
    } catch (error) {
      console.error('[UnifiedNativeApp] Theme validation failed:', error);
    }
  }

  private startUpdateChecking(): void {
    console.log('[UnifiedNativeApp] Starting update checking');
    
    // Check for updates every 30 seconds
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates();
    }, 30000);
    
    // Initial check after 3 seconds
    setTimeout(() => {
      this.checkForUpdates();
    }, 3000);
  }

  private async checkForUpdates(): Promise<void> {
    try {
      console.log('[UnifiedNativeApp] Checking for updates');
      
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        
        if (registration.waiting) {
          console.log('[UnifiedNativeApp] Update available');
          this.showUpdateNotification();
        }
      }
    } catch (error) {
      console.error('[UnifiedNativeApp] Update check failed:', error);
    }
  }

  private showUpdateNotification(): void {
    toast.info('App Update Available!', {
      description: 'Tap to update to the latest version',
      duration: 0,
      action: {
        label: 'Update Now',
        onClick: () => this.executeUpdate()
      }
    });
  }

  private async executeUpdate(): Promise<void> {
    try {
      console.log('[UnifiedNativeApp] Executing update');
      
      toast.info('Updating App...', {
        description: 'Please wait while we update to the latest version',
        duration: 3000
      });
      
      // Clear cache
      await this.clearAppCache();
      
      // Force reload with cache busting
      const url = new URL(window.location.href);
      url.searchParams.set('_update', Date.now().toString());
      url.searchParams.set('_v', this.appInfo.version);
      
      setTimeout(() => {
        window.location.replace(url.toString());
      }, 2000);
      
    } catch (error) {
      console.error('[UnifiedNativeApp] Update failed:', error);
      toast.error('Update Failed', {
        description: 'Please try refreshing the app manually',
        duration: 5000
      });
    }
  }

  private async clearAppCache(): Promise<void> {
    try {
      console.log('[UnifiedNativeApp] Clearing app cache');
      
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
        'sb-auth-token'
      ];
      
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (!keysToKeep.some(keepKey => key.includes(keepKey))) {
          localStorage.removeItem(key);
        }
      });
      
      sessionStorage.clear();
      
      console.log('[UnifiedNativeApp] Cache cleared successfully');
    } catch (error) {
      console.error('[UnifiedNativeApp] Cache clearing failed:', error);
    }
  }

  private ensureProperRouting(): void {
    if (!this.appInfo.isNativeApp) return;
    
    const currentPath = window.location.pathname;
    
    if (currentPath === '/' || !currentPath.startsWith('/app')) {
      console.log('[UnifiedNativeApp] Redirecting to app route');
      
      const newUrl = '/app' + (currentPath === '/' ? '/home' : currentPath);
      window.history.replaceState(null, '', newUrl);
    }
  }

  // Public API methods
  getAppInfo(): UnifiedNativeAppInfo {
    return { ...this.appInfo };
  }

  isNativeApp(): boolean {
    return this.appInfo.isNativeApp;
  }

  isPWABuilder(): boolean {
    return this.appInfo.isPWABuilder;
  }

  isWebView(): boolean {
    return this.appInfo.isWebView;
  }

  async forceRefresh(): Promise<void> {
    await this.executeUpdate();
  }

  async clearCache(): Promise<boolean> {
    try {
      await this.clearAppCache();
      return true;
    } catch {
      return false;
    }
  }

  destroy(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
    
    if (this.themeValidationInterval) {
      clearInterval(this.themeValidationInterval);
      this.themeValidationInterval = null;
    }
    
    this.isInitialized = false;
  }
}

export const unifiedNativeAppService = new UnifiedNativeAppService();
