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
  private initializationPromise: Promise<void> | null = null;

  static getInstance(): NativeIntegrationService {
    if (!NativeIntegrationService.instance) {
      NativeIntegrationService.instance = new NativeIntegrationService();
    }
    return NativeIntegrationService.instance;
  }

  async initialize(): Promise<void> {
    // Prevent multiple initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize();
    return this.initializationPromise;
  }

  private async _doInitialize(): Promise<void> {
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

      // Setup enhanced splash screen management
      this.setupSplashScreenManagement();

      console.log('[NativeIntegration] Native integration service initialized successfully');
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
    // Initialize App plugin with enhanced deep link handling
    if (this.plugins.App) {
      try {
        console.log('[NativeIntegration] Initializing App plugin');
        
        // Listen for app state changes
        this.plugins.App.addListener('appStateChange', (state: any) => {
          console.log('[NativeIntegration] App state changed:', state);
          
          // Hide splash screen when app becomes active if not already hidden
          if (state.isActive && !this.splashScreenHidden) {
            setTimeout(() => {
              this.hideSplashScreen();
            }, 1000);
          }
        });

        // Enhanced URL open event handling
        this.plugins.App.addListener('appUrlOpen', async (event: any) => {
          console.log('[NativeIntegration] App URL opened:', event.url);
          
          // Handle authentication deep links
          if (this.isAuthUrl(event.url)) {
            console.log('[NativeIntegration] Processing auth deep link');
            try {
              const authSuccess = await handleDeepLinkAuth(event.url);
              if (authSuccess) {
                console.log('[NativeIntegration] Deep link authentication successful');
                // Ensure splash screen is hidden after successful auth
                await this.hideSplashScreen();
              } else {
                console.log('[NativeIntegration] Deep link authentication failed');
              }
            } catch (error) {
              console.error('[NativeIntegration] Deep link auth failed:', error);
            }
          }
        });

        console.log('[NativeIntegration] App plugin initialized with enhanced deep link support');
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

    // Enhanced SplashScreen plugin initialization
    if (this.plugins.SplashScreen) {
      try {
        console.log('[NativeIntegration] Setting up enhanced splash screen management');
        // Splash screen will be managed by setupSplashScreenManagement method
        console.log('[NativeIntegration] SplashScreen management initialized');
      } catch (error) {
        console.error('[NativeIntegration] SplashScreen plugin error:', error);
        mobileErrorHandler.handleCapacitorError('SplashScreen', error.toString());
      }
    }
  }

  private isAuthUrl(url: string): boolean {
    return url.includes('access_token') || 
           url.includes('soulo://auth') || 
           url.includes('/app/auth') ||
           url.includes('error=');
  }

  private setupSplashScreenManagement(): void {
    if (!this.plugins.SplashScreen) return;

    console.log('[NativeIntegration] Setting up intelligent splash screen management');

    // Multiple strategies to ensure splash screen is hidden
    
    // Strategy 1: Time-based fallback
    setTimeout(async () => {
      if (!this.splashScreenHidden) {
        console.log('[NativeIntegration] Time-based splash screen hide (fallback)');
        await this.hideSplashScreen();
      }
    }, 5000); // Max 5 seconds

    // Strategy 2: Font and resource readiness
    const checkResourcesReady = () => {
      const fontsReady = (window as any).__SOULO_FONTS_READY__ || false;
      const domReady = document.readyState === 'complete';
      
      if (fontsReady && domReady && !this.splashScreenHidden) {
        console.log('[NativeIntegration] Resources ready, hiding splash screen');
        setTimeout(() => {
          if (!this.splashScreenHidden) {
            this.hideSplashScreen();
          }
        }, 1000); // Small delay for smooth transition
      }
    };

    // Check immediately
    checkResourcesReady();

    // Listen for font ready event
    window.addEventListener('fontsReady', checkResourcesReady);
    
    // Listen for DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkResourcesReady);
    }

    // Strategy 3: App navigation readiness
    window.addEventListener('load', () => {
      setTimeout(() => {
        if (!this.splashScreenHidden) {
          console.log('[NativeIntegration] Window load completed, hiding splash screen');
          this.hideSplashScreen();
        }
      }, 1500);
    });
  }

  // Enhanced splash screen management with retry logic
  async hideSplashScreen(): Promise<void> {
    if (!this.plugins.SplashScreen || this.splashScreenHidden) {
      return;
    }

    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries && !this.splashScreenHidden) {
      try {
        console.log(`[NativeIntegration] Hiding splash screen (attempt ${retryCount + 1})`);
        await this.plugins.SplashScreen.hide({
          fadeOutDuration: 500
        });
        this.splashScreenHidden = true;
        console.log('[NativeIntegration] Splash screen hidden successfully');
        return;
      } catch (error) {
        retryCount++;
        console.error(`[NativeIntegration] Failed to hide splash screen (attempt ${retryCount}):`, error);
        
        if (retryCount < maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          // Final attempt failed, mark as hidden to prevent infinite retries
          this.splashScreenHidden = true;
          mobileErrorHandler.handleCapacitorError('SplashScreen', error.toString());
        }
      }
    }
  }

  async showSplashScreen(): Promise<void> {
    if (this.plugins.SplashScreen) {
      try {
        console.log('[NativeIntegration] Showing splash screen');
        await this.plugins.SplashScreen.show({
          showDuration: 3000,
          fadeInDuration: 300,
          fadeOutDuration: 300,
          autoHide: true
        });
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
