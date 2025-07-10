
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
      console.log('[NativeAppInit] Starting native app initialization...');

      // Step 1: Initialize native integration service
      console.log('[NativeAppInit] Initializing native integration...');
      await nativeIntegrationService.initialize();

      // Step 2: Check if we're actually running natively
      const isActuallyNative = nativeIntegrationService.isRunningNatively();
      console.log('[NativeAppInit] Native environment detected:', isActuallyNative);

      if (isActuallyNative) {
        // Step 3: Initialize native auth service only if truly native
        console.log('[NativeAppInit] Initializing native auth service...');
        try {
          await nativeAuthService.initialize();
          console.log('[NativeAppInit] Native auth service initialized successfully');
        } catch (authError) {
          console.warn('[NativeAppInit] Native auth initialization failed (non-fatal):', authError);
          // Don't fail the entire initialization for auth issues
          mobileErrorHandler.handleError({
            type: 'capacitor',
            message: `Native auth init failed: ${authError}`,
            context: 'nativeAppInit'
          });
        }

        // Step 4: Request necessary permissions
        await this.requestNativePermissions();

        // Step 5: Setup native-specific event listeners
        this.setupNativeEventListeners();

        // Step 6: Configure native UI
        await this.configureNativeUI();
      } else {
        console.log('[NativeAppInit] Running in web environment, skipping native-specific initialization');
      }

      this.isInitialized = true;
      console.log('[NativeAppInit] Native app initialization completed successfully');
      return true;

    } catch (error) {
      console.error('[NativeAppInit] Native app initialization failed:', error);
      mobileErrorHandler.handleError({
        type: 'crash',
        message: `Native app init failed: ${error}`,
        context: 'nativeAppInit'
      });
      
      // Mark as initialized even on failure to prevent retry loops
      this.isInitialized = true;
      return false;
    }
  }

  private async requestNativePermissions(): Promise<void> {
    try {
      console.log('[NativeAppInit] Requesting native permissions...');
      
      const permissions = ['notifications', 'microphone'];
      const results = await nativeIntegrationService.requestPermissions(permissions);
      
      console.log('[NativeAppInit] Permission results:', results);
      
      // Handle permission results
      Object.entries(results).forEach(([permission, status]) => {
        if (status === 'denied') {
          console.warn(`[NativeAppInit] ${permission} permission denied`);
        }
      });

    } catch (error) {
      console.warn('[NativeAppInit] Permission request failed:', error);
      mobileErrorHandler.handleError({
        type: 'permission',
        message: `Permission request failed: ${error}`,
        context: 'nativeAppInit'
      });
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
            // App became active - good place to refresh data if needed
          } else {
            console.log('[NativeAppInit] App became inactive');
            // App became inactive - good place to save state
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

      // Hide splash screen immediately after app initialization is complete
      const splashPlugin = nativeIntegrationService.getPlugin('SplashScreen');
      if (splashPlugin) {
        console.log('[NativeAppInit] Hiding splash screen...');
        try {
          await splashPlugin.hide();
          console.log('[NativeAppInit] Splash screen hidden successfully');
        } catch (error) {
          console.warn('[NativeAppInit] Failed to hide splash screen:', error);
          // Try alternative method
          try {
            await splashPlugin.hide({ fadeOutDuration: 300 });
            console.log('[NativeAppInit] Splash screen hidden with fadeOut');
          } catch (fallbackError) {
            console.error('[NativeAppInit] Splash screen hide fallback also failed:', fallbackError);
          }
        }
      } else {
        console.warn('[NativeAppInit] SplashScreen plugin not available');
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
      
      // Navigate to appropriate route based on deep link
      if (path.includes('/app/')) {
        window.location.href = path;
      } else {
        // Default to app home
        window.location.href = '/app/home';
      }
      
    } catch (error) {
      console.warn('[NativeAppInit] Deep link handling failed:', error);
      // Fallback to app home
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
