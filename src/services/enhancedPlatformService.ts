/**
 * Enhanced Platform Detection Service
 * Provides robust platform detection and capability checking
 */

interface PlatformCapabilities {
  nativeNotifications: boolean;
  serviceWorkerSupported: boolean;
  pushNotifications: boolean;
  backgroundSync: boolean;
  webNotifications: boolean;
}

interface PlatformInfo {
  platform: 'android' | 'ios' | 'web';
  isNative: boolean;
  isWebView: boolean;
  isTWA: boolean;
  isPWA: boolean;
  capabilities: PlatformCapabilities;
}

class EnhancedPlatformService {
  private static instance: EnhancedPlatformService;
  private platformInfo: PlatformInfo | null = null;

  static getInstance(): EnhancedPlatformService {
    if (!EnhancedPlatformService.instance) {
      EnhancedPlatformService.instance = new EnhancedPlatformService();
    }
    return EnhancedPlatformService.instance;
  }

  private log(message: string, data?: any): void {
    console.log(`[EnhancedPlatformService] ${message}`, data);
  }

  async detectPlatform(): Promise<PlatformInfo> {
    if (this.platformInfo) {
      return this.platformInfo;
    }

    this.log('Detecting platform...');

    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroid = userAgent.includes('android');
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    
    // Enhanced native detection
    const isNative = this.detectNativeEnvironment();
    const isWebView = this.detectWebView();
    const isTWA = this.detectTWA();
    const isPWA = this.detectPWA();
    
    const platform = isAndroid ? 'android' : isIOS ? 'ios' : 'web';
    
    // Check capabilities
    const capabilities = await this.checkCapabilities(isNative);
    
    this.platformInfo = {
      platform,
      isNative,
      isWebView,
      isTWA,
      isPWA,
      capabilities
    };

    this.log('Platform detected:', this.platformInfo);
    return this.platformInfo;
  }

  private detectNativeEnvironment(): boolean {
    // Check for Capacitor
    if ((window as any).Capacitor?.isNative) {
      this.log('Capacitor native environment detected');
      return true;
    }

    // Check for Cordova
    if ((window as any).cordova) {
      this.log('Cordova environment detected');
      return true;
    }

    // Check for native app indicators
    if (window.location.protocol === 'capacitor:' || 
        window.location.protocol === 'ionic:' ||
        window.location.href.includes('capacitor://') ||
        window.location.href.includes('ionic://')) {
      this.log('Native app protocol detected');
      return true;
    }

    return false;
  }

  private detectWebView(): boolean {
    const userAgent = navigator.userAgent;
    
    // Android WebView indicators
    if (userAgent.includes('wv') && userAgent.includes('Android')) {
      return true;
    }
    
    // iOS WebView indicators
    if (userAgent.includes('iPhone') && !userAgent.includes('Safari')) {
      return true;
    }
    
    return false;
  }

  private detectTWA(): boolean {
    // TWA (Trusted Web Activity) detection
    return window.matchMedia('(display-mode: standalone)').matches &&
           !this.detectNativeEnvironment() &&
           navigator.userAgent.includes('Android');
  }

  private detectPWA(): boolean {
    // PWA detection
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.matchMedia('(display-mode: fullscreen)').matches ||
           (window.navigator as any).standalone === true;
  }

  private async checkCapabilities(isNative: boolean): Promise<PlatformCapabilities> {
    const capabilities: PlatformCapabilities = {
      nativeNotifications: false,
      serviceWorkerSupported: false,
      pushNotifications: false,
      backgroundSync: false,
      webNotifications: false
    };

    // Check native notifications
    if (isNative) {
      try {
        // Check for Capacitor LocalNotifications
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        if (LocalNotifications) {
          capabilities.nativeNotifications = true;
          this.log('Native notifications available');
        }
      } catch (error) {
        this.log('Native notifications not available:', error);
      }
    }

    // Check service worker support
    if ('serviceWorker' in navigator) {
      capabilities.serviceWorkerSupported = true;
      this.log('Service Worker supported');
    }

    // Check push notifications
    if ('PushManager' in window && 'serviceWorker' in navigator) {
      capabilities.pushNotifications = true;
      this.log('Push notifications supported');
    }

    // Check background sync
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      capabilities.backgroundSync = true;
      this.log('Background sync supported');
    }

    // Check web notifications
    if ('Notification' in window) {
      capabilities.webNotifications = true;
      this.log('Web notifications supported');
    }

    return capabilities;
  }

  getPlatformInfo(): PlatformInfo | null {
    return this.platformInfo;
  }

  isNative(): boolean {
    return this.platformInfo?.isNative || false;
  }

  isMobile(): boolean {
    const platform = this.platformInfo?.platform;
    return platform === 'android' || platform === 'ios';
  }

  canUseNativeNotifications(): boolean {
    return this.platformInfo?.capabilities.nativeNotifications || false;
  }

  canUseServiceWorkerNotifications(): boolean {
    return this.platformInfo?.capabilities.serviceWorkerSupported || false;
  }

  canUseWebNotifications(): boolean {
    return this.platformInfo?.capabilities.webNotifications || false;
  }

  getBestNotificationStrategy(): 'native' | 'serviceWorker' | 'web' | 'none' {
    if (!this.platformInfo) {
      return 'none';
    }

    // Prefer native notifications when available
    if (this.platformInfo.capabilities.nativeNotifications) {
      return 'native';
    }

    // Use service worker for better reliability on web
    if (this.platformInfo.capabilities.serviceWorkerSupported) {
      return 'serviceWorker';
    }

    // Fallback to web notifications
    if (this.platformInfo.capabilities.webNotifications) {
      return 'web';
    }

    return 'none';
  }
}

export const enhancedPlatformService = EnhancedPlatformService.getInstance();