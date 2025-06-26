import { mobileErrorHandler } from './mobileErrorHandler';
import { handleDeepLinkAuth } from './authService';

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
  private plugins: { [key: string]: CapacitorPlugin } = {};
  private deviceInfo: DeviceInfo | null = null;
  private splashScreenHidden = false;

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
      } else {
        console.log('[NativeIntegration] Running in web environment');
      }

      // Initialize device info
      await this.initializeDeviceInfo();

      // Setup plugin error handlers
      this.setupPluginErrorHandlers();

      console.log('[NativeIntegration] Native integration service initialized');
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

  private async initializeCapacitor(): Promise<void> {
    try {
      const { Capacitor } = (window as any);
      
      if (Capacitor && Capacitor.Plugins) {
        this.plugins = Capacitor.Plugins;
        this.isCapacitorReady = true;
        
        console.log('[NativeIntegration] Available Capacitor plugins:', Object.keys(this.plugins));
        
        // Initialize core plugins safely
        await this.initializeCorePlugins();
      }
    } catch (error) {
      console.error('[NativeIntegration] Capacitor initialization failed:', error);
      mobileErrorHandler.handleCapacitorError('Core', error.toString());
    }
  }

  private async initializeCorePlugins(): Promise<void> {
    // Initialize App plugin with deep link handling
    if (this.plugins.App) {
      try {
        console.log('[NativeIntegration] Initializing App plugin');
        
        // Listen for app state changes
        this.plugins.App.addListener('appStateChange', (state: any) => {
          console.log('[NativeIntegration] App state changed:', state);
        });

        // Listen for URL open events (deep links)
        this.plugins.App.addListener('appUrlOpen', async (event: any) => {
          console.log('[NativeIntegration] App URL opened:', event.url);
          
          // Handle authentication deep links
          if (event.url.includes('access_token') || event.url.includes('soulo://auth')) {
            console.log('[NativeIntegration] Processing auth deep link');
            try {
              const authSuccess = await handleDeepLinkAuth(event.url);
              if (authSuccess) {
                console.log('[NativeIntegration] Deep link authentication successful');
              } else {
                console.log('[NativeIntegration] Deep link authentication failed');
              }
            } catch (error) {
              console.error('[NativeIntegration] Deep link auth failed:', error);
            }
          }
        });

        console.log('[NativeIntegration] App plugin initialized with deep link support');
      } catch (error) {
        console.error('[NativeIntegration] App plugin initialization failed:', error);
        mobileErrorHandler.handleCapacitorError('App', error.toString());
      }
    }

    // Initialize Status Bar plugin
    if (this.plugins.StatusBar) {
      try {
        await this.plugins.StatusBar.setStyle({ style: 'dark' });
        await this.plugins.StatusBar.setBackgroundColor({ color: '#000000' });
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

    // Initialize SplashScreen plugin with proper timing and error handling
    if (this.plugins.SplashScreen) {
      try {
        console.log('[NativeIntegration] Setting up splash screen management');
        
        // Hide splash screen after a delay, but ensure fonts and critical resources are loaded
        setTimeout(async () => {
          if (!this.splashScreenHidden) {
            // Check if fonts are ready before hiding splash
            const fontsReady = (window as any).__SOULO_FONTS_READY__ || false;
            if (fontsReady) {
              await this.hideSplashScreen();
            } else {
              // Wait a bit more for fonts, but don't wait forever
              setTimeout(async () => {
                if (!this.splashScreenHidden) {
                  await this.hideSplashScreen();
                }
              }, 2000);
            }
          }
        }, 2000);
        
        // Also listen for font ready event
        window.addEventListener('fontsReady', async () => {
          console.log('[NativeIntegration] Fonts ready event received');
          if (!this.splashScreenHidden) {
            // Small delay to ensure UI is stable
            setTimeout(async () => {
              if (!this.splashScreenHidden) {
                await this.hideSplashScreen();
              }
            }, 500);
          }
        });
        
        console.log('[NativeIntegration] SplashScreen management initialized');
      } catch (error) {
        console.error('[NativeIntegration] SplashScreen plugin error:', error);
        mobileErrorHandler.handleCapacitorError('SplashScreen', error.toString());
      }
    }
  }

  // Enhanced splash screen management
  async hideSplashScreen(): Promise<void> {
    if (this.plugins.SplashScreen && !this.splashScreenHidden) {
      try {
        console.log('[NativeIntegration] Hiding splash screen');
        await this.plugins.SplashScreen.hide();
        this.splashScreenHidden = true;
        console.log('[NativeIntegration] Splash screen hidden successfully');
      } catch (error) {
        console.error('[NativeIntegration] Failed to hide splash screen:', error);
        // Don't throw error, just mark as hidden to prevent retry loops
        this.splashScreenHidden = true;
        mobileErrorHandler.handleCapacitorError('SplashScreen', error.toString());
      }
    }
  }

  async showSplashScreen(): Promise<void> {
    if (this.plugins.SplashScreen) {
      try {
        console.log('[NativeIntegration] Showing splash screen');
        await this.plugins.SplashScreen.show();
        this.splashScreenHidden = false;
        console.log('[NativeIntegration] Splash screen shown');
      } catch (error) {
        console.error('[NativeIntegration] Failed to show splash screen:', error);
        mobileErrorHandler.handleCapacitorError('SplashScreen', error.toString());
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

  // Public methods
  isRunningNatively(): boolean {
    return this.isCapacitorReady;
  }

  getPlatform(): string {
    return this.deviceInfo?.platform || 'unknown';
  }

  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  async requestPermissions(permissions: string[]): Promise<{ [key: string]: string }> {
    const results: { [key: string]: string } = {};
    
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

  // Safe plugin access
  getPlugin(name: string): CapacitorPlugin | null {
    if (this.isCapacitorReady && this.plugins[name]) {
      return this.plugins[name];
    }
    return null;
  }

  // Check if specific plugin is available
  isPluginAvailable(name: string): boolean {
    return this.isCapacitorReady && !!this.plugins[name];
  }
}

export const nativeIntegrationService = NativeIntegrationService.getInstance();
