
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { PushNotifications } from '@capacitor/push-notifications';

export class NativeIntegrationService {
  private static instance: NativeIntegrationService;
  private isNative: boolean;

  private constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  static getInstance(): NativeIntegrationService {
    if (!NativeIntegrationService.instance) {
      NativeIntegrationService.instance = new NativeIntegrationService();
    }
    return NativeIntegrationService.instance;
  }

  /**
   * Initialize native platform features
   */
  async initialize(): Promise<void> {
    if (!this.isNative) {
      console.log('[Native] Running in web mode, skipping native initialization');
      return;
    }

    console.log('[Native] Initializing native platform features');

    try {
      // Configure status bar
      await this.configureStatusBar();
      
      // Setup keyboard handlers
      await this.setupKeyboardHandlers();
      
      // Initialize push notifications
      await this.initializePushNotifications();
      
      // Setup app event listeners
      await this.setupAppEventListeners();
      
      // Hide splash screen after initialization
      setTimeout(async () => {
        await this.hideSplashScreen();
      }, 2000);

    } catch (error) {
      console.error('[Native] Error during initialization:', error);
    }
  }

  /**
   * Configure status bar appearance
   */
  private async configureStatusBar(): Promise<void> {
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#000000' });
      console.log('[Native] Status bar configured');
    } catch (error) {
      console.error('[Native] Error configuring status bar:', error);
    }
  }

  /**
   * Setup keyboard event handlers
   */
  private async setupKeyboardHandlers(): Promise<void> {
    try {
      Keyboard.addListener('keyboardWillShow', (info) => {
        console.log('[Native] Keyboard will show:', info);
        document.body.style.paddingBottom = `${info.keyboardHeight}px`;
      });

      Keyboard.addListener('keyboardWillHide', () => {
        console.log('[Native] Keyboard will hide');
        document.body.style.paddingBottom = '0px';
      });

      console.log('[Native] Keyboard handlers setup');
    } catch (error) {
      console.error('[Native] Error setting up keyboard handlers:', error);
    }
  }

  /**
   * Initialize push notifications
   */
  private async initializePushNotifications(): Promise<void> {
    try {
      const permission = await PushNotifications.requestPermissions();
      
      if (permission.receive === 'granted') {
        await PushNotifications.register();
        console.log('[Native] Push notifications initialized');
      }

      PushNotifications.addListener('registration', (token) => {
        console.log('[Native] Push registration token:', token.value);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Native] Push notification received:', notification);
      });

    } catch (error) {
      console.error('[Native] Error initializing push notifications:', error);
    }
  }

  /**
   * Setup app event listeners
   */
  private async setupAppEventListeners(): Promise<void> {
    try {
      App.addListener('appStateChange', ({ isActive }) => {
        console.log('[Native] App state changed. Active:', isActive);
        
        if (isActive) {
          // App came to foreground
          this.onAppResume();
        } else {
          // App went to background
          this.onAppPause();
        }
      });

      App.addListener('backButton', ({ canGoBack }) => {
        console.log('[Native] Back button pressed. Can go back:', canGoBack);
        
        if (canGoBack) {
          window.history.back();
        } else {
          // Show exit confirmation or minimize app
          App.minimizeApp();
        }
      });

      console.log('[Native] App event listeners setup');
    } catch (error) {
      console.error('[Native] Error setting up app event listeners:', error);
    }
  }

  /**
   * Hide splash screen
   */
  private async hideSplashScreen(): Promise<void> {
    try {
      await SplashScreen.hide({
        fadeOutDuration: 300
      });
      console.log('[Native] Splash screen hidden');
    } catch (error) {
      console.error('[Native] Error hiding splash screen:', error);
    }
  }

  /**
   * Handle app resume
   */
  private onAppResume(): void {
    console.log('[Native] App resumed');
    // Refresh data, check for updates, etc.
  }

  /**
   * Handle app pause
   */
  private onAppPause(): void {
    console.log('[Native] App paused');
    // Save state, pause timers, etc.
  }

  /**
   * Get device info
   */
  async getDeviceInfo(): Promise<any> {
    if (!this.isNative) return null;

    try {
      const info = await App.getInfo();
      console.log('[Native] Device info:', info);
      return info;
    } catch (error) {
      console.error('[Native] Error getting device info:', error);
      return null;
    }
  }

  /**
   * Check if running on native platform
   */
  isRunningNatively(): boolean {
    return this.isNative;
  }

  /**
   * Get platform name
   */
  getPlatform(): string {
    return Capacitor.getPlatform();
  }
}

export const nativeIntegrationService = NativeIntegrationService.getInstance();
