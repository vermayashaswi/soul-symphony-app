import { mobileErrorHandler } from './mobileErrorHandler';

interface CapacitorPlugin {
  [key: string]: any;
}

interface DeviceInfo {
  platform: string;
  model: string;
  osVersion: string;
  manufacturer: string;
  isVirtual: boolean;
}

class NativeIntegrationService {
  private static instance: NativeIntegrationService;
  private isCapacitorReady = false;
  private isActuallyNative = false; // New flag for true native detection
  private plugins: { [key: string]: CapacitorPlugin } = {};
  private deviceInfo: DeviceInfo | null = null;

  static getInstance(): NativeIntegrationService {
    if (!NativeIntegrationService.instance) {
      NativeIntegrationService.instance = new NativeIntegrationService();
    }
    return NativeIntegrationService.instance;
  }

  async initialize(): Promise<void> {
    console.log('[NativeIntegration] Initializing native integration service');

    try {
      // Check if Capacitor is available
      if (this.isCapacitorAvailable()) {
        console.log('[NativeIntegration] Capacitor detected');
        await this.initializeCapacitor();
        
        // Additional check to determine if we're actually running natively
        await this.detectNativeEnvironment();
      } else {
        console.log('[NativeIntegration] Running in web environment');
      }

      // Initialize device info
      await this.initializeDeviceInfo();

      // Setup plugin error handlers only if truly native
      if (this.isActuallyNative) {
        this.setupPluginErrorHandlers();
      }

      console.log('[NativeIntegration] Native integration service initialized', {
        capacitorReady: this.isCapacitorReady,
        actuallyNative: this.isActuallyNative,
        platform: this.getPlatform()
      });
    } catch (error) {
      console.error('[NativeIntegration] Failed to initialize:', error);
      mobileErrorHandler.handleError({
        type: 'unknown',
        message: `Native integration initialization failed: ${error}`
      });
    }
  }

  private isCapacitorAvailable(): boolean {
    return typeof window !== 'undefined' && !!(window as any).Capacitor;
  }

  private async detectNativeEnvironment(): Promise<void> {
    try {
      console.log('[NativeIntegration] Starting native environment detection...');
      
      const { Capacitor } = (window as any);
      
      if (Capacitor) {
        // Check if we're running on a native platform
        const platform = Capacitor.getPlatform();
        console.log('[NativeIntegration] Capacitor platform detected:', platform);
        
        // Only consider it native if platform is 'ios' or 'android'
        // 'web' means we're in a browser with Capacitor loaded but not native
        this.isActuallyNative = platform === 'ios' || platform === 'android';
        
        console.log('[NativeIntegration] Platform-based native detection:', this.isActuallyNative);
        
        // Additional robust checks for native environment
        if (this.isActuallyNative) {
          console.log('[NativeIntegration] Running additional native environment checks...');
          
          // Check 1: Verify we can access native plugins
          try {
            if (Capacitor.Plugins?.Device) {
              const deviceInfo = await Capacitor.Plugins.Device.getInfo();
              console.log('[NativeIntegration] Device plugin test successful:', {
                platform: deviceInfo.platform,
                model: deviceInfo.model
              });
            }
            
            // Check 2: Verify we're not in a web context
            if (Capacitor.Plugins?.App) {
              console.log('[NativeIntegration] App plugin available - confirming native context');
            }
            
            // Check 3: Additional native context verification
            const isWebView = window.location.protocol.includes('http') && 
                             window.location.hostname !== 'localhost' && 
                             !window.location.hostname.includes('capacitor');
            
            if (isWebView) {
              console.warn('[NativeIntegration] Detected web view context, may not be truly native');
            }
            
          } catch (error) {
            console.warn('[NativeIntegration] Failed to access native APIs:', error);
            // If we can't access native APIs, we're probably not truly native
            this.isActuallyNative = false;
          }
        }
        
        // Force native detection for APK builds (additional safety check)
        if (!this.isActuallyNative && (platform === 'ios' || platform === 'android')) {
          console.log('[NativeIntegration] Force enabling native mode for mobile platform');
          this.isActuallyNative = true;
        }
        
      } else {
        console.log('[NativeIntegration] Capacitor not detected - web environment');
        this.isActuallyNative = false;
      }
      
      console.log('[NativeIntegration] Final native environment status:', this.isActuallyNative);
    } catch (error) {
      console.error('[NativeIntegration] Error detecting native environment:', error);
      this.isActuallyNative = false;
    }
  }

  private async initializeCapacitor(): Promise<void> {
    try {
      const { Capacitor } = (window as any);
      
      if (Capacitor && Capacitor.Plugins) {
        this.plugins = Capacitor.Plugins;
        this.isCapacitorReady = true;
        
        console.log('[NativeIntegration] Available Capacitor plugins:', Object.keys(this.plugins));
        
        // Only initialize core plugins if we're actually running natively
        if (this.isActuallyNative) {
          await this.initializeCorePlugins();
        } else {
          console.log('[NativeIntegration] Skipping native plugin initialization - running in web environment');
        }
      }
    } catch (error) {
      console.error('[NativeIntegration] Capacitor initialization failed:', error);
      mobileErrorHandler.handleCapacitorError('Core', error.toString());
    }
  }

  private async initializeCorePlugins(): Promise<void> {
    // Initialize App plugin
    if (this.plugins.App) {
      try {
        // Listen for app state changes
        this.plugins.App.addListener('appStateChange', (state: any) => {
          console.log('[NativeIntegration] App state changed:', state);
        });

        // Listen for URL open events (OAuth callbacks)
        this.plugins.App.addListener('appUrlOpen', (event: any) => {
          console.log('[NativeIntegration] App URL opened:', event.url);
          this.handleOAuthCallback(event.url);
        });

        console.log('[NativeIntegration] App plugin initialized');
      } catch (error) {
        console.error('[NativeIntegration] App plugin initialization failed:', error);
        mobileErrorHandler.handleCapacitorError('App', error.toString());
      }
    }

    // Initialize Status Bar plugin
    if (this.plugins.StatusBar) {
      try {
        await this.plugins.StatusBar.setStyle({ style: 'dark' });
        await this.plugins.StatusBar.setBackgroundColor({ color: '#FFFFFF' });
        console.log('[NativeIntegration] StatusBar plugin initialized');
      } catch (error) {
        console.error('[NativeIntegration] StatusBar plugin initialization failed:', error);
        mobileErrorHandler.handleCapacitorError('StatusBar', error.toString());
      }
    }

    // Initialize Keyboard plugin
    if (this.plugins.Keyboard) {
      try {
        this.plugins.Keyboard.addListener('keyboardWillShow', (info: any) => {
          console.log('[NativeIntegration] Keyboard will show:', info);
          document.body.classList.add('keyboard-visible');
        });

        this.plugins.Keyboard.addListener('keyboardWillHide', () => {
          console.log('[NativeIntegration] Keyboard will hide');
          document.body.classList.remove('keyboard-visible');
        });

        console.log('[NativeIntegration] Keyboard plugin initialized');
      } catch (error) {
        console.error('[NativeIntegration] Keyboard plugin initialization failed:', error);
        mobileErrorHandler.handleCapacitorError('Keyboard', error.toString());
      }
    }

    // Initialize SplashScreen plugin - DO NOT auto-hide here
    if (this.plugins.SplashScreen) {
      console.log('[NativeIntegration] SplashScreen plugin available - will be managed by nativeAppInitService');
    }

    // Initialize Browser plugin for OAuth flows
    if (this.plugins.Browser) {
      console.log('[NativeIntegration] Browser plugin available for OAuth redirects');
    }

    // Initialize Google Auth plugin
    if (this.plugins.GoogleAuth) {
      try {
        console.log('[NativeIntegration] GoogleAuth plugin detected and available');
      } catch (error) {
        console.error('[NativeIntegration] GoogleAuth plugin initialization failed:', error);
        mobileErrorHandler.handleCapacitorError('GoogleAuth', error.toString());
      }
    }
  }

  private async initializeDeviceInfo(): Promise<void> {
    if (this.plugins.Device) {
      try {
        const info = await this.plugins.Device.getInfo();
        this.deviceInfo = {
          platform: info.platform || 'unknown',
          model: info.model || 'unknown',
          osVersion: info.osVersion || 'unknown',
          manufacturer: info.manufacturer || 'unknown',
          isVirtual: info.isVirtual || false
        };
        
        console.log('[NativeIntegration] Device info:', this.deviceInfo);
      } catch (error) {
        console.error('[NativeIntegration] Failed to get device info:', error);
        // Fallback to user agent detection
        this.deviceInfo = this.getDeviceInfoFromUserAgent();
      }
    } else {
      // Fallback for web environment
      this.deviceInfo = this.getDeviceInfoFromUserAgent();
    }
  }

  private getDeviceInfoFromUserAgent(): DeviceInfo {
    const ua = navigator.userAgent;
    let platform = 'web';
    
    if (ua.includes('Android')) {
      platform = 'android';
    } else if (ua.includes('iPhone') || ua.includes('iPad')) {
      platform = 'ios';
    }
    
    return {
      platform,
      model: 'unknown',
      osVersion: 'unknown',
      manufacturer: 'unknown',
      isVirtual: false
    };
  }

  private setupPluginErrorHandlers(): void {
    // Global plugin error handler
    if (this.isCapacitorReady) {
      const originalConsoleError = console.error;
      console.error = (...args) => {
        originalConsoleError.apply(console, args);
        
        const errorMessage = args.join(' ');
        if (errorMessage.includes('Capacitor') || errorMessage.includes('Plugin')) {
          mobileErrorHandler.handleCapacitorError('Unknown', errorMessage);
        }
      };
    }
  }

  private handleOAuthCallback(url: string): void {
    try {
      console.log('[NativeIntegration] Handling OAuth callback URL:', url);
      
      // Check if this is a Supabase OAuth callback
      if (url.includes('oauth/callback') || url.includes('access_token')) {
        // Extract the hash fragment if present (OAuth parameters)
        const urlObj = new URL(url);
        const fragment = urlObj.hash || urlObj.search;
        
        if (fragment) {
          // Redirect to the app auth page with the OAuth parameters
          const newUrl = `/app/auth${fragment}`;
          console.log('[NativeIntegration] Redirecting to:', newUrl);
          
          // Use setTimeout to ensure app is ready
          setTimeout(() => {
            window.location.href = newUrl;
          }, 100);
        } else {
          // Fallback to app home if no parameters
          window.location.href = '/app/home';
        }
      } else {
        // Handle other deep links
        console.log('[NativeIntegration] Handling general deep link:', url);
        const urlObj = new URL(url);
        const path = urlObj.pathname || '/app/home';
        window.location.href = path;
      }
    } catch (error) {
      console.error('[NativeIntegration] Error handling OAuth callback:', error);
      // Fallback to app home
      window.location.href = '/app/home';
    }
  }

  // Public methods
  isRunningNatively(): boolean {
    return this.isActuallyNative;
  }

  getPlatform(): string {
    if (this.isActuallyNative && this.isCapacitorReady) {
      try {
        const { Capacitor } = (window as any);
        return Capacitor.getPlatform();
      } catch (error) {
        console.error('[NativeIntegration] Error getting platform:', error);
      }
    }
    return this.deviceInfo?.platform || 'web';
  }

  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  async requestPermissions(permissions: string[]): Promise<{ [key: string]: string }> {
    const results: { [key: string]: string } = {};
    
    if (!this.isActuallyNative) {
      console.log('[NativeIntegration] Permission requests not available in web environment');
      permissions.forEach(permission => {
        results[permission] = 'granted'; // Assume granted for web
      });
      return results;
    }
    
    for (const permission of permissions) {
      try {
        if (permission === 'microphone' && this.plugins.Microphone) {
          const result = await this.plugins.Microphone.requestPermissions();
          results[permission] = result.microphone || 'denied';
        } else if (permission === 'notifications' && this.plugins.LocalNotifications) {
          const result = await this.plugins.LocalNotifications.requestPermissions();
          results[permission] = result.display || 'denied';
        } else if (permission === 'push-notifications' && this.plugins.PushNotifications) {
          const result = await this.plugins.PushNotifications.requestPermissions();
          results[permission] = result.receive || 'denied';
        }
      } catch (error) {
        console.error(`[NativeIntegration] Failed to request ${permission} permission:`, error);
        results[permission] = 'denied';
        mobileErrorHandler.handlePermissionError(permission);
      }
    }
    
    return results;
  }

  async hideStatusBar(): Promise<void> {
    if (this.plugins.StatusBar) {
      try {
        await this.plugins.StatusBar.hide();
      } catch (error) {
        console.error('[NativeIntegration] Failed to hide status bar:', error);
        mobileErrorHandler.handleCapacitorError('StatusBar', error.toString());
      }
    }
  }

  async showStatusBar(): Promise<void> {
    if (this.plugins.StatusBar) {
      try {
        await this.plugins.StatusBar.show();
      } catch (error) {
        console.error('[NativeIntegration] Failed to show status bar:', error);
        mobileErrorHandler.handleCapacitorError('StatusBar', error.toString());
      }
    }
  }

  async vibrate(duration: number = 100): Promise<void> {
    if (this.plugins.Haptics) {
      try {
        await this.plugins.Haptics.vibrate({ duration });
      } catch (error) {
        console.error('[NativeIntegration] Failed to vibrate:', error);
        mobileErrorHandler.handleCapacitorError('Haptics', error.toString());
      }
    } else if ('vibrate' in navigator) {
      // Fallback to web vibration API
      navigator.vibrate(duration);
    }
  }

  async exitApp(): Promise<void> {
    if (this.plugins.App) {
      try {
        await this.plugins.App.exitApp();
      } catch (error) {
        console.error('[NativeIntegration] Failed to exit app:', error);
        mobileErrorHandler.handleCapacitorError('App', error.toString());
      }
    }
  }

  // Network status
  async getNetworkStatus(): Promise<{ connected: boolean; connectionType: string }> {
    if (this.plugins.Network) {
      try {
        const status = await this.plugins.Network.getStatus();
        return {
          connected: status.connected,
          connectionType: status.connectionType
        };
      } catch (error) {
        console.error('[NativeIntegration] Failed to get network status:', error);
        mobileErrorHandler.handleCapacitorError('Network', error.toString());
      }
    }
    
    // Fallback
    return {
      connected: navigator.onLine,
      connectionType: 'unknown'
    };
  }

  // Check if Google Auth plugin is available
  isGoogleAuthAvailable(): boolean {
    return this.isActuallyNative && this.isCapacitorReady && !!this.plugins.GoogleAuth;
  }

  // Safe plugin access
  getPlugin(name: string): CapacitorPlugin | null {
    if (this.isActuallyNative && this.isCapacitorReady && this.plugins[name]) {
      return this.plugins[name];
    }
    return null;
  }

  // Check if specific plugin is available
  isPluginAvailable(name: string): boolean {
    return this.isActuallyNative && this.isCapacitorReady && !!this.plugins[name];
  }
}

export const nativeIntegrationService = NativeIntegrationService.getInstance();
