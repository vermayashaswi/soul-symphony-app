import { toast } from 'sonner';

interface MobileError {
  type: 'crash' | 'android_webview' | 'permission' | 'audio' | 'storage' | 'network' | 'capacitor' | 'javascript' | 'unknown';
  message: string;
  stack?: string;
  timestamp: number;
  platform?: string;
  details?: any;
  context?: string;
}

function getPlatform(): string {
  try {
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      const platform = (window as any).Capacitor.getPlatform();
      if (platform) return platform;
    }
  } catch {}
  
  if (typeof navigator !== 'undefined') {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('android')) return 'android';
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios';
  }
  
  return 'web';
}

class MobileErrorHandler {
  private static instance: MobileErrorHandler;
  private errorQueue: MobileError[] = [];
  private isOnline: boolean = true;
  private lastToastAt: Record<string, number> = {};
  private suppressNoisyToasts: boolean = true;

  private constructor() {
    this.initialize();
  }

  static getInstance(): MobileErrorHandler {
    if (!MobileErrorHandler.instance) {
      MobileErrorHandler.instance = new MobileErrorHandler();
    }
    return MobileErrorHandler.instance;
  }

  private initialize(): void {
    this.setupGlobalErrorHandlers();
    this.setupNetworkHandlers();
    this.setupCapacitorErrorHandlers();
    this.setupAndroidSpecificHandlers();
    this.startCrashDetection();
    
    // Process error queue periodically
    setInterval(() => this.processErrorQueue(), 30000);
  }

  private setupGlobalErrorHandlers(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.handleError({
        type: 'javascript',
        message: event.message || 'Unknown JavaScript error',
        stack: event.error?.stack,
        timestamp: Date.now(),
        platform: getPlatform(),
        details: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: 'javascript',
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        timestamp: Date.now(),
        platform: getPlatform()
      });
    });
  }

  private setupNetworkHandlers(): void {
    // Monitor network status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processErrorQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.handleError({
        type: 'network',
        message: 'Device went offline',
        timestamp: Date.now(),
        platform: getPlatform()
      });
    });
  }

  private setupCapacitorErrorHandlers(): void {
    // Check if Capacitor is available using the correct path
    if (typeof window !== 'undefined' && (window as any).Capacitor?.Plugins) {
      try {
        // Listen for capacitor plugin errors
        window.addEventListener('capacitorPluginError', (event: any) => {
          this.handleError({
            type: 'capacitor',
            message: `Capacitor Plugin Error: ${event.detail?.message || 'Unknown plugin error'}`,
            timestamp: Date.now(),
            platform: getPlatform(),
            details: event.detail
          });
        });

        // Monitor app state changes for potential crashes
        const { App } = (window as any).Capacitor.Plugins;
        if (App) {
          App.addListener('appStateChange', (state: any) => {
            if (!state.isActive) {
              // App is backgrounded, save current state for crash detection
              localStorage.setItem('app_state_backgrounded', Date.now().toString());
            } else {
              // App is foregrounded, check if it was a potential crash
              const backgrounded = localStorage.getItem('app_state_backgrounded');
              if (backgrounded) {
                const backgroundTime = parseInt(backgrounded);
                const elapsed = Date.now() - backgroundTime;
                
                // If app was backgrounded for more than 30 seconds, consider it a potential crash
                if (elapsed > 30000) {
                  this.handleError({
                    type: 'crash',
                    message: 'Potential app crash detected (long background time)',
                    timestamp: Date.now(),
                    platform: getPlatform(),
                    details: { backgroundedFor: elapsed }
                  });
                }
                localStorage.removeItem('app_state_backgrounded');
              }
            }
          });
        }
      } catch (error) {
        console.warn('[MobileErrorHandler] Failed to setup Capacitor error handlers:', error);
      }
    }
  }

  private setupAndroidSpecificHandlers(): void {
    if (getPlatform() === 'android') {
      // Override console.error to catch WebView-specific errors
      const originalConsoleError = console.error;
      console.error = (...args: any[]) => {
        originalConsoleError.apply(console, args);
        
        const errorMessage = args.join(' ');
        if (errorMessage.includes('WebView') || errorMessage.includes('chromium')) {
          this.handleError({
            type: 'android_webview',
            message: `Android WebView Error: ${errorMessage}`,
            timestamp: Date.now(),
            platform: 'android'
          });
        }
      };
    }
  }

  private startCrashDetection(): void {
    // Check if app crashed during last session
    const lastTimestamp = localStorage.getItem('app_heartbeat');
    const currentTime = Date.now();
    
    if (lastTimestamp) {
      const lastTime = parseInt(lastTimestamp);
      const timeDiff = currentTime - lastTime;
      
      // If more than 5 minutes since last heartbeat, consider it a crash
      if (timeDiff > 300000) {
        this.handleError({
          type: 'crash',
          message: 'App crash detected from previous session',
          timestamp: currentTime,
          platform: getPlatform(),
          details: { timeSinceLastHeartbeat: timeDiff }
        });
      }
    }
    
    // Set up heartbeat
    const updateHeartbeat = () => {
      localStorage.setItem('app_heartbeat', Date.now().toString());
    };
    
    updateHeartbeat();
    setInterval(updateHeartbeat, 60000); // Update every minute
  }

  handleError(error: Partial<MobileError>): void {
    const fullError: MobileError = {
      type: error.type || 'unknown',
      message: error.message || 'Unknown error',
      stack: error.stack,
      timestamp: error.timestamp || Date.now(),
      platform: error.platform || getPlatform(),
      details: error.details,
      context: error.context
    };

    console.log('[MobileErrorHandler] Captured error:', fullError);
    
    // Add to queue for processing
    this.errorQueue.push(fullError);
    
    // Show user-friendly message
    this.showUserFriendlyError(fullError);
    
    // Attempt recovery for critical errors
    if (fullError.type === 'crash' || fullError.type === 'android_webview') {
      this.attemptRecovery(fullError);
    }
    
    // Process queue if online
    if (this.isOnline) {
      this.processErrorQueue();
    }
  }

  private showUserFriendlyError(error: MobileError): void {
    const now = Date.now();
    
    // Suppress streaming-related errors during normal operation
    if (error.message?.includes('streaming') || 
        error.message?.includes('edge function') ||
        error.message?.includes('retry') ||
        error.message?.includes('FunctionsError')) {
      console.log('[MobileErrorHandler] Suppressing streaming-related error toast:', error.message);
      return;
    }
    
    // Suppress noisy toasts under certain conditions
    if (this.suppressNoisyToasts && (
      error.type === 'network' || 
      error.type === 'capacitor'
    )) {
      console.log('[MobileErrorHandler] Suppressing noisy toast for:', error.type, error.message);
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
      case 'unknown':
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