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
  private isActuallyNative = false;
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
      if (this.isCapacitorAvailable()) {
        console.log('[NativeIntegration] Capacitor detected');
        await this.initializeCapacitor();
        await this.detectNativeEnvironment();
      } else {
        console.log('[NativeIntegration] Running in web environment');
      }

      await this.initializeDeviceInfo();

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
        const platform = Capacitor.getPlatform();
        console.log('[NativeIntegration] Capacitor platform detected:', platform);

        // CRITICAL FIX: Only consider it native if platform is 'ios' or 'android'
        this.isActuallyNative = platform === 'ios' || platform === 'android';

        console.log('[NativeIntegration] Platform-based native detection:', this.isActuallyNative);

        if (this.isActuallyNative) {
          console.log('[NativeIntegration] Confirmed native environment - no browser fallbacks will be used');

          // Additional verification for completeness
          try {
            if (Capacitor.Plugins?.Device) {
              const deviceInfo = await Capacitor.Plugins.Device.getInfo();
              console.log('[NativeIntegration] Device plugin confirmed:', {
                platform: deviceInfo.platform,
                model: deviceInfo.model
              });
            }
          } catch (error) {
            console.warn('[NativeIntegration] Device plugin check failed:', error);
            // Don't fail the native detection for this
          }
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
    // Initialize App plugin for deep link handling
    if (this.plugins.App) {
      try {
        this.plugins.App.addListener('appStateChange', (state: any) => {
          console.log('[NativeIntegration] App state changed:', state);
        });

        // CRITICAL: Handle OAuth callbacks through deep links
        this.plugins.App.addListener('appUrlOpen', (event: any) => {
          console.log('[NativeIntegration] App URL opened:', event.url);
          this.handleDeepLink(event.url);
        });

        console.log('[NativeIntegration] App plugin initialized');
      } catch (error) {
        console.error('[NativeIntegration] App plugin initialization failed:', error);
        mobileErrorHandler.handleCapacitorError('App', error.toString());
      }
    }

    // Enhanced StatusBar initialization with overlap prevention
    if (this.plugins.StatusBar) {
      try {
        await this.plugins.StatusBar.setStyle({ style: 'dark' });
        await this.plugins.StatusBar.setBackgroundColor({ color: '#FFFFFF' });
        await this.plugins.StatusBar.setOverlaysWebView({ overlay: false });
        
        console.log('[NativeIntegration] StatusBar plugin initialized with overlap prevention');
      } catch (error) {
        console.error('[NativeIntegration] StatusBar plugin initialization failed:', error);
        mobileErrorHandler.handleCapacitorError('StatusBar', error.toString());
      }
    }

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

    if (this.plugins.GoogleAuth) {
      console.log('[NativeIntegration] GoogleAuth plugin detected and available for native authentication');
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
        this.deviceInfo = this.getDeviceInfoFromUserAgent();
      }
    } else {
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

  // CRITICAL: Fixed deep link handling for OAuth
  private handleDeepLink(url: string): void {
    try {
      console.log('[NativeIntegration] Handling deep link URL:', url);

      // Parse the URL to check for OAuth parameters
      const urlObj = new URL(url);

      // Check if this is a Supabase OAuth callback
      if (url.includes('oauth/callback') ||
          url.includes('access_token') ||
          url.includes('code=') ||
          urlObj.hash.includes('access_token') ||
          urlObj.search.includes('code=')) {

        console.log('[NativeIntegration] OAuth callback detected in deep link');

        // Extract OAuth parameters from hash or search
        const fragment = urlObj.hash || urlObj.search;

        if (fragment) {
          // Navigate to auth page with OAuth parameters for processing
          const authUrl = `/app/auth${fragment}`;
          console.log('[NativeIntegration] Redirecting to auth page:', authUrl);

          // Use history.pushState to navigate without full page reload
          setTimeout(() => {
            window.history.pushState({}, '', authUrl);
            // Trigger a popstate event to notify React Router
            window.dispatchEvent(new PopStateEvent('popstate'));
          }, 100);
        } else {
          // No OAuth parameters found, go to app home
          console.log('[NativeIntegration] No OAuth parameters, redirecting to app home');
          setTimeout(() => {
            window.history.pushState({}, '', '/app/home');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }, 100);
        }
      } else {
        // Handle other deep links
        console.log('[NativeIntegration] Handling general deep link:', url);
        const path = urlObj.pathname || '/app/home';
        setTimeout(() => {
          window.history.pushState({}, '', path);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, 100);
      }
    } catch (error) {
      console.error('[NativeIntegration] Error handling deep link:', error);
      // Fallback to app home
      setTimeout(() => {
        window.history.pushState({}, '', '/app/home');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, 100);
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

  isGoogleAuthAvailable(): boolean {
    return this.isActuallyNative && this.isCapacitorReady && !!this.plugins.GoogleAuth;
  }

  getPlugin(name: string): CapacitorPlugin | null {
    if (this.isActuallyNative && this.isCapacitorReady && this.plugins[name]) {
      return this.plugins[name];
    }
    return null;
  }

  isPluginAvailable(name: string): boolean {
    return this.isActuallyNative && this.isCapacitorReady && !!this.plugins[name];
  }

  async checkPermissions(permissions: string[]): Promise<{ [key: string]: string }> {
    const results: { [key: string]: string } = {};

    if (!this.isActuallyNative) {
      console.log('[NativeIntegration] Permission checks not available in web environment');
      permissions.forEach(permission => {
        results[permission] = 'granted';
      });
      return results;
    }

    for (const permission of permissions) {
      try {
        if (permission === 'microphone' && this.plugins.Microphone) {
          const result = await this.plugins.Microphone.checkPermissions();
          results[permission] = result.microphone || 'prompt';
        } else if (permission === 'notifications') {
          if (this.plugins.LocalNotifications) {
            try {
              const result = await this.plugins.LocalNotifications.checkPermissions();
              results[permission] = result.display || 'prompt';
            } catch (localError) {
              if (this.plugins.PushNotifications) {
                try {
                  const result = await this.plugins.PushNotifications.checkPermissions();
                  results[permission] = result.receive || 'prompt';
                } catch (pushError) {
                  results[permission] = 'prompt';
                }
              } else {
                results[permission] = 'prompt';
              }
            }
          } else if (this.plugins.PushNotifications) {
            try {
              const result = await this.plugins.PushNotifications.checkPermissions();
              results[permission] = result.receive || 'prompt';
            } catch (pushError) {
              results[permission] = 'prompt';
            }
          } else {
            results[permission] = 'prompt';
          }
        }
      } catch (error) {
        console.error(`[NativeIntegration] Failed to check ${permission} permission:`, error);
        results[permission] = 'prompt';
      }
    }

    console.log('[NativeIntegration] Permission check results:', results);
    return results;
  }

  async requestPermissions(permissions: string[]): Promise<{ [key: string]: string }> {
    const results: { [key: string]: string } = {};

    if (!this.isActuallyNative) {
      console.log('[NativeIntegration] Permission requests not available in web environment');
      permissions.forEach(permission => {
        results[permission] = 'granted';
      });
      return results;
    }

    for (const permission of permissions) {
      try {
        if (permission === 'microphone' && this.plugins.Microphone) {
          const result = await this.plugins.Microphone.requestPermissions();
          results[permission] = result.microphone || 'denied';
        } else if (permission === 'notifications') {
          // Try LocalNotifications first (preferred for journal reminders)
          if (this.plugins.LocalNotifications) {
            try {
              console.log('[NativeIntegration] Requesting LocalNotifications permission');
              const result = await this.plugins.LocalNotifications.requestPermissions();
              console.log('[NativeIntegration] LocalNotifications result:', result);
              results[permission] = result.display || 'denied';
            } catch (localError) {
              console.warn('[NativeIntegration] LocalNotifications failed, trying PushNotifications:', localError);
              
              // Fallback to PushNotifications
              if (this.plugins.PushNotifications) {
                try {
                  const result = await this.plugins.PushNotifications.requestPermissions();
                  console.log('[NativeIntegration] PushNotifications result:', result);
                  results[permission] = result.receive || 'denied';
                } catch (pushError) {
                  console.error('[NativeIntegration] PushNotifications also failed:', pushError);
                  results[permission] = 'denied';
                }
              } else {
                results[permission] = 'denied';
              }
            }
          } else if (this.plugins.PushNotifications) {
            try {
              console.log('[NativeIntegration] Requesting PushNotifications permission');
              const result = await this.plugins.PushNotifications.requestPermissions();
              console.log('[NativeIntegration] PushNotifications result:', result);
              results[permission] = result.receive || 'denied';
            } catch (pushError) {
              console.error('[NativeIntegration] PushNotifications failed:', pushError);
              results[permission] = 'denied';
            }
          } else {
            console.warn('[NativeIntegration] No notification plugins available');
            results[permission] = 'denied';
          }
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

    console.log('[NativeIntegration] Permission results:', results);
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

    return {
      connected: navigator.onLine,
      connectionType: 'unknown'
    };
  }
}

export const nativeIntegrationService = NativeIntegrationService.getInstance();
