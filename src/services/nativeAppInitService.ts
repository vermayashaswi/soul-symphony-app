
import { nativeIntegrationService } from './nativeIntegrationService';
import { nativeAuthService } from './nativeAuthService';
import { mobileErrorHandler } from './mobileErrorHandler';
import { toast } from 'sonner';

class NativeAppInitService {
  private static instance: NativeAppInitService;
  private isInitialized = false;
  private initializationPromise: Promise<boolean> | null = null;

  static getInstance(): NativeAppInitService {
    if (!NativeAppInitService.instance) {
      NativeAppInitService.instance = new NativeAppInitService();
    }
    return NativeAppInitService.instance;
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<boolean> {
    try {
      console.log('[NativeAppInit] Starting optimized native app initialization...');

      // Step 1: Initialize native integration service (fast)
      await nativeIntegrationService.initialize();

      // Step 2: Check if we're actually running natively
      const isActuallyNative = nativeIntegrationService.isRunningNatively();
      console.log('[NativeAppInit] Native environment detected:', isActuallyNative);

      if (isActuallyNative) {
        // Step 3: Initialize auth service asynchronously (non-blocking)
        this.initializeAuthServiceAsync();
        
        // Step 4: Setup event listeners (fast, synchronous)
        this.setupNativeEventListeners();

        // Step 5: Configure UI asynchronously (non-blocking)
        this.configureNativeUIAsync();
      } else {
        console.log('[NativeAppInit] Running in web environment, skipping native-specific initialization');
      }

      this.isInitialized = true;
      console.log('[NativeAppInit] Native app initialization completed successfully (optimized)');
      return true;

    } catch (error) {
      console.error('[NativeAppInit] Native app initialization failed:', error);
      mobileErrorHandler.handleError({
        type: 'crash',
        message: `Native app init failed: ${error}`,
        context: 'nativeAppInit'
      });
      
      this.isInitialized = true; // Don't block app startup
      return false;
    }
  }

  private async initializeAuthServiceAsync(): Promise<void> {
    try {
      console.log('[NativeAppInit] Initializing native auth service (async)...');
      await nativeAuthService.initialize();
      console.log('[NativeAppInit] Native auth service initialized successfully');
    } catch (error) {
      console.warn('[NativeAppInit] Native auth initialization failed (non-fatal):', error);
      mobileErrorHandler.handleError({
        type: 'capacitor',
        message: `Native auth init failed: ${error}`,
        context: 'nativeAppInit'
      });
    }
  }

  private async configureNativeUIAsync(): Promise<void> {
    try {
      console.log('[NativeAppInit] Configuring native UI (async)...');
      await this.configureNativeUI();
    } catch (error) {
      console.warn('[NativeAppInit] Native UI configuration failed (non-fatal):', error);
    }
  }

  private setupNativeEventListeners(): void {
    try {
      console.log('[NativeAppInit] Setting up native event listeners...');

      // Listen for app state changes
      const appPlugin = nativeIntegrationService.getPlugin('App');
      if (appPlugin) {
        appPlugin.addListener('appStateChange', (state: any) => {
          console.log('[NativeAppInit] App state changed:', state);
          
          if (state.isActive) {
            console.log('[NativeAppInit] App became active');
          } else {
            console.log('[NativeAppInit] App became inactive');
          }
        });

        // Listen for URL open events (deep links)
        appPlugin.addListener('appUrlOpen', (event: any) => {
          console.log('[NativeAppInit] App URL opened:', event);
          this.handleDeepLink(event.url);
        });
      }

      // Listen for network changes
      const networkPlugin = nativeIntegrationService.getPlugin('Network');
      if (networkPlugin) {
        networkPlugin.addListener('networkStatusChange', (status: any) => {
          console.log('[NativeAppInit] Network status changed:', status);
          
          if (!status.connected) {
            toast.info('You are offline. Some features may not work.');
          }
        });
      }

    } catch (error) {
      console.warn('[NativeAppInit] Failed to setup native event listeners:', error);
      mobileErrorHandler.handleError({
        type: 'capacitor',
        message: `Event listener setup failed: ${error}`,
        context: 'nativeAppInit'
      });
    }
  }

  private async configureNativeUI(): Promise<void> {
    try {
      console.log('[NativeAppInit] Configuring native UI...');

      // Configure status bar
      await nativeIntegrationService.showStatusBar();

      // Hide splash screen after initialization
      const splashPlugin = nativeIntegrationService.getPlugin('SplashScreen');
      if (splashPlugin) {
        console.log('[NativeAppInit] Hiding splash screen...');
        try {
          await splashPlugin.hide();
          console.log('[NativeAppInit] Splash screen hidden successfully');
        } catch (error) {
          console.warn('[NativeAppInit] Failed to hide splash screen:', error);
          try {
            await splashPlugin.hide({ fadeOutDuration: 300 });
            console.log('[NativeAppInit] Splash screen hidden with fadeOut');
          } catch (fallbackError) {
            console.error('[NativeAppInit] Splash screen hide fallback also failed:', fallbackError);
          }
        }
      }

    } catch (error) {
      console.warn('[NativeAppInit] Native UI configuration failed:', error);
      mobileErrorHandler.handleError({
        type: 'capacitor',
        message: `Native UI config failed: ${error}`,
        context: 'nativeAppInit'
      });
    }
  }

  private handleDeepLink(url: string): void {
    try {
      console.log('[NativeAppInit] Handling deep link:', url);
      
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      
      if (path.includes('/app/')) {
        window.location.href = path;
      } else {
        window.location.href = '/app/home';
      }
      
    } catch (error) {
      console.warn('[NativeAppInit] Deep link handling failed:', error);
      window.location.href = '/app/home';
    }
  }

  isNativeAppInitialized(): boolean {
    return this.isInitialized;
  }

  async getInitializationStatus(): Promise<{
    initialized: boolean;
    nativeEnvironment: boolean;
    authAvailable: boolean;
    platform: string;
  }> {
    await this.initialize();
    
    return {
      initialized: this.isInitialized,
      nativeEnvironment: nativeIntegrationService.isRunningNatively(),
      authAvailable: nativeIntegrationService.isGoogleAuthAvailable(),
      platform: nativeIntegrationService.getPlatform()
    };
  }
}

export const nativeAppInitService = NativeAppInitService.getInstance();
