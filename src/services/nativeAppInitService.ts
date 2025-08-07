
import { nativeIntegrationService } from './nativeIntegrationService';
import { nativeAuthService } from './nativeAuthService';
import { enhancedPlatformService } from './enhancedPlatformService';
import { SplashScreen } from '@capacitor/splash-screen';
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

    this.initializationPromise = this.performInitialization().then(() => {
      this.isInitialized = true;
      return true;
    }).catch(() => {
      this.isInitialized = true; // Mark as initialized even if failed
      return false;
    });
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      console.log('[NativeAppInit] Starting native app initialization...');
      
      // Set timeout for native initialization to prevent hanging
      const initTimeout = setTimeout(() => {
        console.warn('[NativeAppInit] Initialization timeout reached, proceeding with basic setup');
        this.isInitialized = true;
      }, 3000); // 3 second timeout
      
      try {
        // Initialize native integration service first
        await nativeIntegrationService.initialize();
        
        // Check if we're actually running in a native environment
        const isNative = nativeIntegrationService.isRunningNatively();
        console.log('[NativeAppInit] Native environment detected:', isNative);
        
        if (isNative) {
          // Initialize native-specific services with individual error handling
          try {
            await nativeAuthService.initialize();
          } catch (authError) {
            console.warn('[NativeAppInit] Native auth initialization failed (non-critical):', authError);
          }
          
          // Set up native event listeners
          try {
            this.setupNativeEventListeners();
          } catch (listenerError) {
            console.warn('[NativeAppInit] Event listener setup failed (non-critical):', listenerError);
          }
          
          // Configure native UI
          try {
            await this.configureNativeUI();
          } catch (uiError) {
            console.warn('[NativeAppInit] Native UI configuration failed (non-critical):', uiError);
          }
        }
        
        // Clear timeout if we completed successfully
        clearTimeout(initTimeout);
        console.log('[NativeAppInit] Native app initialization completed successfully');
      } catch (error) {
        clearTimeout(initTimeout);
        throw error;
      }
    } catch (error) {
      console.error('[NativeAppInit] Native app initialization failed:', error);
      // Don't throw the error - allow app to continue with limited functionality
      console.warn('[NativeAppInit] Continuing with limited native functionality');
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
      
      // Show status bar with error handling
      try {
        await nativeIntegrationService.showStatusBar();
      } catch (statusError) {
        console.warn('[NativeAppInit] Status bar configuration failed:', statusError);
      }
      
      // Hide splash screen with multiple fallback strategies and forced timeout
      try {
        // Set a forced timeout to hide splash screen regardless
        const forceHide = setTimeout(() => {
          console.warn('[NativeAppInit] Force hiding splash screen due to timeout');
          SplashScreen.hide().catch(() => {
            console.warn('[NativeAppInit] Force hide also failed, splash may remain visible');
          });
        }, 2000); // Force hide after 2 seconds
        
        try {
          await SplashScreen.hide({
            fadeOutDuration: 300
          });
          clearTimeout(forceHide);
          console.log('[NativeAppInit] Splash screen hidden with animation');
        } catch (splashError) {
          console.warn('[NativeAppInit] Animated splash hide failed, trying basic hide:', splashError);
          
          // Fallback to basic hide
          try {
            await SplashScreen.hide();
            clearTimeout(forceHide);
            console.log('[NativeAppInit] Splash screen hidden (fallback)');
          } catch (fallbackError) {
            console.warn('[NativeAppInit] Basic splash hide failed, relying on timeout:', fallbackError);
            // Let the timeout handle it
          }
        }
      } catch (error) {
        console.warn('[NativeAppInit] All splash screen hide attempts failed:', error);
        // Try one more time with a delay
        setTimeout(() => {
          SplashScreen.hide().catch(() => {
            console.error('[NativeAppInit] Final splash screen hide attempt failed');
          });
        }, 1000);
      }
      
      console.log('[NativeAppInit] Native UI configuration completed');
    } catch (error) {
      console.error('[NativeAppInit] Native UI configuration failed:', error);
      // Don't throw - allow app to continue
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
