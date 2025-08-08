import { toast } from 'sonner';

// Simple platform detection to avoid circular dependency
const getPlatform = (): string => {
  if (typeof window === 'undefined') return 'node';
  
  const { Capacitor } = (window as any);
  if (Capacitor) {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios' || platform === 'android') {
      return platform;
    }
  }
  
  const ua = navigator.userAgent;
  if (ua.includes('Android')) return 'android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'ios';
  return 'web';
};

interface MobileError {
  type: 'crash' | 'network' | 'permission' | 'storage' | 'audio' | 'android_webview' | 'capacitor' | 'unknown';
  message: string;
  stack?: string;
  timestamp: number;
  platform?: string;
  appVersion?: string;
  url?: string;
  userAgent?: string;
  context?: string;
}

class MobileErrorHandler {
  private static instance: MobileErrorHandler;
  private errorQueue: MobileError[] = [];
  private isOnline: boolean = navigator.onLine;
  private crashDetectionActive: boolean = false;
  // Suppress noisy toasts during startup and dedupe frequent messages
  private appStartTime: number = Date.now();
  private suppressStartupMs: number = 7000; // Do not toast minor errors in first 7s
  private lastToastAt: Record<string, number> = {};


  static getInstance(): MobileErrorHandler {
    if (!MobileErrorHandler.instance) {
      MobileErrorHandler.instance = new MobileErrorHandler();
    }
    return MobileErrorHandler.instance;
  }

  constructor() {
    this.setupGlobalErrorHandlers();
    this.setupNetworkListeners();
    this.setupAndroidSpecificHandlers();
    this.startCrashDetection();
  }

  private setupGlobalErrorHandlers(): void {
    // Catch unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      console.error('[MobileErrorHandler] Global error:', event);
      this.handleError({
        type: this.classifyError(event.message || event.error?.message || 'Unknown error'),
        message: event.message || event.error?.message || 'Unknown error occurred',
        stack: event.error?.stack,
        timestamp: Date.now(),
        platform: getPlatform(),
        url: window.location.href,
        userAgent: navigator.userAgent
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[MobileErrorHandler] Unhandled promise rejection:', event);
      this.handleError({
        type: this.classifyError(event.reason?.toString() || 'Promise rejection'),
        message: `Unhandled promise rejection: ${event.reason}`,
        stack: event.reason?.stack,
        timestamp: Date.now(),
        platform: getPlatform(),
        url: window.location.href,
        userAgent: navigator.userAgent
      });
    });

    // Capacitor-specific error handling
    if ((window as any).Capacitor) {
      console.log('[MobileErrorHandler] Capacitor detected, setting up native error handlers');
      this.setupCapacitorErrorHandlers();
    }
  }

  private setupCapacitorErrorHandlers(): void {
    // Listen for Capacitor plugin errors
    document.addEventListener('capacitorPluginError', (event: any) => {
      console.error('[MobileErrorHandler] Capacitor plugin error:', event.detail);
      this.handleError({
        type: 'capacitor',
        message: `Capacitor plugin error: ${event.detail.message || 'Unknown plugin error'}`,
        stack: event.detail.stack,
        timestamp: Date.now(),
        platform: getPlatform()
      });
    });

    // Monitor Capacitor app state for crashes
    if ((window as any).Capacitor?.Plugins?.App) {
      const { App } = (window as any).Capacitor.Plugins;
      
      App.addListener('appStateChange', (state: any) => {
        console.log('[MobileErrorHandler] App state changed:', state);
        if (!state.isActive && this.crashDetectionActive) {
          // App went to background, could indicate a crash
          localStorage.setItem('app_last_background', Date.now().toString());
        }
      });
    }
  }

  private setupAndroidSpecificHandlers(): void {
    // Android WebView specific error handling
    if (navigator.userAgent.includes('Android')) {
      console.log('[MobileErrorHandler] Android detected, setting up Android-specific handlers');
      
      // Monitor for WebView crashes
      let consecutiveErrors = 0;
      const originalConsoleError = console.error;
      
      console.error = (...args) => {
        originalConsoleError.apply(console, args);
        
        const errorMessage = args.join(' ');
        if (this.isWebViewError(errorMessage)) {
          consecutiveErrors++;
          
          if (consecutiveErrors > 3) {
            this.handleError({
              type: 'android_webview',
              message: 'Multiple WebView errors detected, possible crash imminent',
              timestamp: Date.now(),
              platform: 'android'
            });
          }
        }
      };

      // Reset consecutive error counter periodically
      setInterval(() => {
        consecutiveErrors = 0;
      }, 10000);
    }
  }

  private startCrashDetection(): void {
    this.crashDetectionActive = true;
    
    // Check if app crashed on last run
    const lastBackground = localStorage.getItem('app_last_background');
    const lastForeground = localStorage.getItem('app_last_foreground');
    
    if (lastBackground && !lastForeground) {
      const backgroundTime = parseInt(lastBackground);
      const timeDiff = Date.now() - backgroundTime;
      
      // If app was backgrounded more than 30 seconds ago without coming back to foreground,
      // it might have crashed
      if (timeDiff > 30000) {
        this.handleError({
          type: 'crash',
          message: 'Potential app crash detected on previous session',
          timestamp: Date.now(),
          platform: getPlatform()
        });
      }
    }
    
    // Mark app as active
    localStorage.setItem('app_last_foreground', Date.now().toString());
    localStorage.removeItem('app_last_background');
  }

  private classifyError(message: string): MobileError['type'] {
    const msg = message.toLowerCase();
    
    if (msg.includes('webview') || msg.includes('chromium')) {
      return 'android_webview';
    }
    if (msg.includes('capacitor') || msg.includes('plugin')) {
      return 'capacitor';
    }
    if (msg.includes('permission') || msg.includes('denied')) {
      return 'permission';
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('cors')) {
      return 'network';
    }
    if (msg.includes('audio') || msg.includes('microphone') || msg.includes('recording')) {
      return 'audio';
    }
    if (msg.includes('storage') || msg.includes('quota') || msg.includes('disk')) {
      return 'storage';
    }
    if (msg.includes('crash') || msg.includes('segmentation fault') || msg.includes('null pointer')) {
      return 'crash';
    }
    
    return 'unknown';
  }

  private isWebViewError(message: string): boolean {
    const webViewErrors = [
      'webview',
      'chromium',
      'renderer',
      'gpu process',
      'out of memory',
      'segmentation fault'
    ];
    
    const msg = message.toLowerCase();
    return webViewErrors.some(error => msg.includes(error));
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[MobileErrorHandler] Network connection restored');
      toast.success('Connection restored');
      this.processErrorQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[MobileErrorHandler] Network connection lost');
      toast.error('Connection lost - working offline');
      this.handleError({
        type: 'network',
        message: 'Device went offline',
        timestamp: Date.now(),
        platform: getPlatform(),
      });
    });
  }

  handleError(error: Partial<MobileError>): void {
    const fullError: MobileError = {
      type: error.type || 'unknown',
      message: error.message || 'An error occurred',
      stack: error.stack,
      timestamp: error.timestamp || Date.now(),
      platform: error.platform || getPlatform(),
      appVersion: '1.0.0',
      url: error.url || window.location.href,
      userAgent: error.userAgent || navigator.userAgent,
      context: error.context
    };

    console.error('[MobileErrorHandler] Error captured:', fullError);

    // Add to queue for later processing if offline
    this.errorQueue.push(fullError);

    // Show user-friendly error message
    this.showUserFriendlyError(fullError);

    // Process immediately if online
    if (this.isOnline) {
      this.processErrorQueue();
    }

    // For critical errors, attempt recovery
    if (fullError.type === 'crash' || fullError.type === 'android_webview') {
      this.attemptRecovery(fullError);
    }
  }

  private showUserFriendlyError(error: MobileError): void {
    // Suppress noisy non-critical toasts right after startup (especially in native)
    const now = Date.now();
    const isStartup = now - this.appStartTime < this.suppressStartupMs;
    if (isStartup && (error.type === 'unknown' || error.type === 'capacitor')) {
      console.log('[MobileErrorHandler] Suppressing startup toast for minor error:', error.type);
      return;
    }

    let userMessage = '';

    switch (error.type) {
      case 'crash':
        userMessage = 'The app encountered an unexpected error. Attempting to recover...';
        break;
      case 'android_webview':
        userMessage = 'Display issue detected. The app will try to refresh automatically.';
        break;
      case 'capacitor':
        userMessage = 'Native feature error. Some functions may be temporarily unavailable.';
        break;
      case 'network':
        userMessage = 'Network connection issue. Some features may be limited.';
        break;
      case 'permission':
        userMessage = 'Permission required to access this feature.';
        break;
      case 'storage':
        userMessage = 'Storage error occurred. Please check available space.';
        break;
      case 'audio':
        userMessage = 'Audio recording error. Please check microphone permissions.';
        break;
      default:
        userMessage = 'Something went wrong. The app will try to recover.';
    }

    // Dedupe frequent identical toasts within 30s
    const key = `${error.type}:${userMessage}`;
    const last = this.lastToastAt[key] || 0;
    if (now - last < 30000) {
      console.log('[MobileErrorHandler] Suppressing duplicate toast:', key);
      return;
    }
    this.lastToastAt[key] = now;

    toast.error(userMessage);
  }

  private attemptRecovery(error: MobileError): void {
    console.log('[MobileErrorHandler] Attempting recovery for:', error.type);
    
    setTimeout(() => {
      try {
        // Clear any stuck states
        if (error.type === 'android_webview') {
          // Force a gentle page refresh for WebView issues
          window.location.hash = '#recovery';
          setTimeout(() => {
            window.location.hash = '';
          }, 1000);
        }
        
        // Clear localStorage cache that might be corrupted
        const keysToPreserve = ['userId', 'auth_token', 'user_preferences'];
        const allKeys = Object.keys(localStorage);
        
        allKeys.forEach(key => {
          if (!keysToPreserve.includes(key) && key.includes('cache')) {
            localStorage.removeItem(key);
          }
        });
        
        console.log('[MobileErrorHandler] Recovery attempt completed');
      } catch (recoveryError) {
        console.error('[MobileErrorHandler] Recovery failed:', recoveryError);
      }
    }, 2000);
  }

  private async processErrorQueue(): Promise<void> {
    if (this.errorQueue.length === 0 || !this.isOnline) {
      return;
    }

    try {
      // In a real app, you would send these to your error tracking service
      console.log('[MobileErrorHandler] Processing error queue:', this.errorQueue);
      
      // Clear the queue after successful processing
      this.errorQueue = [];
    } catch (error) {
      console.error('[MobileErrorHandler] Failed to process error queue:', error);
    }
  }

  // Helper methods for specific error types
  handlePermissionError(permission: string): void {
    this.handleError({
      type: 'permission',
      message: `Permission denied: ${permission}`,
      timestamp: Date.now()
    });
  }

  handleAudioError(message: string): void {
    this.handleError({
      type: 'audio',
      message: `Audio error: ${message}`,
      timestamp: Date.now()
    });
  }

  handleStorageError(message: string): void {
    this.handleError({
      type: 'storage',
      message: `Storage error: ${message}`,
      timestamp: Date.now()
    });
  }

  handleNetworkError(message: string): void {
    this.handleError({
      type: 'network',
      message: `Network error: ${message}`,
      timestamp: Date.now()
    });
  }

  handleCapacitorError(plugin: string, message: string): void {
    this.handleError({
      type: 'capacitor',
      message: `Capacitor ${plugin} error: ${message}`,
      timestamp: Date.now()
    });
  }
}

export const mobileErrorHandler = MobileErrorHandler.getInstance();
