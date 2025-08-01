import { Capacitor } from '@capacitor/core';

interface StatusBarControllerPlugin {
  enableAutoHide(): Promise<void>;
  disableAutoHide(): Promise<void>;
  showStatusBar(): Promise<void>;
  hideStatusBar(): Promise<void>;
  resetAutoHideTimer(): Promise<void>;
}

class StatusBarAutoHideService {
  private static instance: StatusBarAutoHideService;
  private plugin: StatusBarControllerPlugin | null = null;
  private autoHideTimer: NodeJS.Timeout | null = null;
  private isEnabled = true;
  private isVisible = false;
  private readonly AUTO_HIDE_DELAY = 3000;
  private activityListeners: (() => void)[] = [];
  private isNative = false;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): StatusBarAutoHideService {
    if (!StatusBarAutoHideService.instance) {
      StatusBarAutoHideService.instance = new StatusBarAutoHideService();
    }
    return StatusBarAutoHideService.instance;
  }

  private async initialize() {
    this.isNative = Capacitor.isNativePlatform();
    
    if (!this.isNative) {
      console.log('[StatusBarAutoHide] Not running on native platform, auto-hide disabled');
      return;
    }

    try {
      // Get the plugin from Capacitor
      const { Capacitor } = await import('@capacitor/core');
      this.plugin = (Capacitor as any).Plugins?.StatusBarController as StatusBarControllerPlugin;
      
      console.log('[StatusBarAutoHide] Service initialized');
      
      // Set up activity listeners
      this.setupActivityListeners();
      
      // Enable auto-hide by default
      await this.enable();
      
    } catch (error) {
      console.error('[StatusBarAutoHide] Failed to initialize:', error);
    }
  }

  private setupActivityListeners() {
    // Listen for user interactions
    const events = ['touchstart', 'touchmove', 'touchend', 'scroll', 'keydown'];
    
    events.forEach(event => {
      const listener = () => this.onUserActivity();
      document.addEventListener(event, listener, { passive: true });
      this.activityListeners.push(() => {
        document.removeEventListener(event, listener);
      });
    });

    // Listen for focus/visibility changes
    const visibilityListener = () => {
      if (document.visibilityState === 'visible') {
        this.onUserActivity();
      }
    };
    
    document.addEventListener('visibilitychange', visibilityListener);
    this.activityListeners.push(() => {
      document.removeEventListener('visibilitychange', visibilityListener);
    });

    // Listen for window focus
    const focusListener = () => this.onUserActivity();
    window.addEventListener('focus', focusListener);
    this.activityListeners.push(() => {
      window.removeEventListener('focus', focusListener);
    });

    // Listen for orientation changes
    const orientationListener = () => {
      // Delay to allow for orientation transition
      setTimeout(() => this.onUserActivity(), 500);
    };
    
    window.addEventListener('orientationchange', orientationListener);
    this.activityListeners.push(() => {
      window.removeEventListener('orientationchange', orientationListener);
    });
  }

  private onUserActivity = () => {
    if (!this.isEnabled || !this.plugin) return;

    // Show status bar if hidden
    if (!this.isVisible) {
      this.showStatusBar();
    }

    // Reset the auto-hide timer
    this.resetAutoHideTimer();
  };

  private resetAutoHideTimer() {
    if (!this.isEnabled) return;

    // Clear existing timer
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
    }

    // Set new timer
    this.autoHideTimer = setTimeout(() => {
      this.hideStatusBar();
    }, this.AUTO_HIDE_DELAY);

    // Also reset native timer
    if (this.plugin) {
      this.plugin.resetAutoHideTimer().catch(error => {
        console.error('[StatusBarAutoHide] Failed to reset native timer:', error);
      });
    }
  }

  public async enable(): Promise<void> {
    if (!this.plugin) return;

    try {
      this.isEnabled = true;
      await this.plugin.enableAutoHide();
      this.resetAutoHideTimer();
      console.log('[StatusBarAutoHide] Auto-hide enabled');
    } catch (error) {
      console.error('[StatusBarAutoHide] Failed to enable auto-hide:', error);
    }
  }

  public async disable(): Promise<void> {
    if (!this.plugin) return;

    try {
      this.isEnabled = false;
      
      // Clear timer
      if (this.autoHideTimer) {
        clearTimeout(this.autoHideTimer);
        this.autoHideTimer = null;
      }

      await this.plugin.disableAutoHide();
      console.log('[StatusBarAutoHide] Auto-hide disabled');
    } catch (error) {
      console.error('[StatusBarAutoHide] Failed to disable auto-hide:', error);
    }
  }

  public async showStatusBar(): Promise<void> {
    if (!this.plugin) return;

    try {
      await this.plugin.showStatusBar();
      this.isVisible = true;
      console.log('[StatusBarAutoHide] Status bar shown');
    } catch (error) {
      console.error('[StatusBarAutoHide] Failed to show status bar:', error);
    }
  }

  public async hideStatusBar(): Promise<void> {
    if (!this.plugin) return;

    try {
      await this.plugin.hideStatusBar();
      this.isVisible = false;
      console.log('[StatusBarAutoHide] Status bar hidden');
    } catch (error) {
      console.error('[StatusBarAutoHide] Failed to hide status bar:', error);
    }
  }

  public async toggleStatusBar(): Promise<void> {
    if (this.isVisible) {
      await this.hideStatusBar();
    } else {
      await this.showStatusBar();
    }
  }

  public isAutoHideEnabled(): boolean {
    return this.isEnabled;
  }

  public isStatusBarVisible(): boolean {
    return this.isVisible;
  }

  public async pauseAutoHide(): Promise<void> {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
  }

  public async resumeAutoHide(): Promise<void> {
    if (this.isEnabled) {
      this.resetAutoHideTimer();
    }
  }

  public destroy() {
    // Clean up timers
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
    }

    // Remove all listeners
    this.activityListeners.forEach(cleanup => cleanup());
    this.activityListeners = [];

    console.log('[StatusBarAutoHide] Service destroyed');
  }
}

export const statusBarAutoHideService = StatusBarAutoHideService.getInstance();