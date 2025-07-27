
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

      // Step 1: Initialize native integration service (required first)
      await nativeIntegrationService.initialize();

      // Step 2: Check if we're actually running natively
      const isActuallyNative = nativeIntegrationService.isRunningNatively();
      console.log('[NativeAppInit] Native environment detected:', isActuallyNative);

      if (isActuallyNative) {
        // Parallelize non-dependent operations for faster initialization
        const [authInitResult, uiConfigResult] = await Promise.allSettled([
          this.initializeNativeAuth(),
          this.configureNativeUI()
        ]);

        // Log results but don't fail on auth errors (non-critical)
        if (authInitResult.status === 'rejected') {
          console.warn('[NativeAppInit] Native auth initialization failed (non-fatal):', authInitResult.reason);
        }
        
        if (uiConfigResult.status === 'rejected') {
          console.warn('[NativeAppInit] Native UI configuration failed (non-fatal):', uiConfigResult.reason);
        }

        // Setup event listeners (synchronous, no await needed)
        this.setupNativeEventListeners();

        console.log('[NativeAppInit] Optimized native initialization completed');
      } else {
        console.log('[NativeAppInit] Web environment detected, minimal initialization');
      }

      this.isInitialized = true;
      return true;

    } catch (error) {
      console.error('[NativeAppInit] Critical initialization failure:', error);
      mobileErrorHandler.handleError({
        type: 'crash',
        message: `Native app init failed: ${error}`,
        context: 'nativeAppInit'
      });
      
      // Mark as initialized even on error to prevent blocking
      this.isInitialized = true;
      return false;
    }
  }

  private async initializeNativeAuth(): Promise<void> {
    try {
      await nativeAuthService.initialize();
      console.log('[NativeAppInit] Native auth service initialized');
    } catch (error) {
      console.warn('[NativeAppInit] Auth init failed:', error);
      mobileErrorHandler.handleError({
        type: 'capacitor',
        message: `Native auth init failed: ${error}`,
        context: 'nativeAppInit'
      });
      throw error; // Let Promise.allSettled handle this
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
