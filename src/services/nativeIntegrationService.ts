import { mobileErrorHandler } from './mobileErrorHandler';
import { initializeWebViewOAuth, cleanupWebViewOAuth } from '@/utils/webviewOAuthHandler';

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
        
        // Initialize WebView OAuth handling for native apps
        initializeWebViewOAuth();
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
    // Initialize App plugin
    if (this.plugins.App) {
      try {
        // Listen for app state changes
        this.plugins.App.addListener('appStateChange', (state: any) => {
          console.log('[NativeIntegration] App state changed:', state);
        });

        // Listen for URL open events
        this.plugins.App.addListener('appUrlOpen', (event: any) => {
          console.log('[NativeIntegration] App URL opened:', event);
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

    // Initialize SplashScreen plugin with proper timing
    if (this.plugins.SplashScreen) {
      try {
        // Hide splash screen after ensuring app is ready
        setTimeout(async () => {
          await this.hideSplashScreen();
        }, 3000); // 3 seconds to match config
      } catch (error) {
        console.error('[NativeIntegration] SplashScreen plugin error:', error);
        mobileErrorHandler.handleCapacitorError('SplashScreen', error.toString());
      }
    }
  }

  /**
   * Hide splash screen with proper error handling
   */
  async hideSplashScreen(): Promise<void> {
    if (this.plugins.SplashScreen) {
      try {
        await this.plugins.SplashScreen.hide();
        console.log('[NativeIntegration] Splash screen hidden');
      } catch (error) {
        console.error('[NativeIntegration] Failed to hide splash screen:', error);
        // Don't throw error as this is not critical
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

  /**
   * Cleanup resources when app is closing
   */
  cleanup(): void {
    if (this.isCapacitorReady) {
      cleanupWebViewOAuth();
    }
  }
}

export const nativeIntegrationService = NativeIntegrationService.getInstance();
