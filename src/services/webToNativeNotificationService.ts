
import { toast } from 'sonner';

// WebToNative-specific notification service
export class WebToNativeNotificationService {
  private static instance: WebToNativeNotificationService;
  private isWebToNative = false;
  private notificationPermission: NotificationPermission = 'default';

  constructor() {
    this.detectWebToNative();
    this.initializePermissionStatus();
  }

  static getInstance(): WebToNativeNotificationService {
    if (!WebToNativeNotificationService.instance) {
      WebToNativeNotificationService.instance = new WebToNativeNotificationService();
    }
    return WebToNativeNotificationService.instance;
  }

  private detectWebToNative(): void {
    // Check for WebToNative environment indicators
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroidWebView = userAgent.includes('wv') && userAgent.includes('android');
    const isIOSWebView = userAgent.includes('ios') && !userAgent.includes('safari');
    
    // Check for WebToNative-specific global variables
    const hasWebToNativeGlobal = typeof (window as any).WebToNative !== 'undefined';
    const hasReactNativeGlobal = typeof (window as any).ReactNativeWebView !== 'undefined';
    
    this.isWebToNative = hasWebToNativeGlobal || hasReactNativeGlobal || isAndroidWebView || isIOSWebView;
    
    console.log('[WebToNative] Environment detection:', {
      isWebToNative: this.isWebToNative,
      userAgent,
      hasWebToNativeGlobal,
      hasReactNativeGlobal,
      isAndroidWebView,
      isIOSWebView
    });
  }

  private initializePermissionStatus(): void {
    if ('Notification' in window) {
      this.notificationPermission = Notification.permission;
    } else if (this.isWebToNative) {
      // In WebToNative, assume notifications are available but need permission
      this.notificationPermission = 'default';
    } else {
      this.notificationPermission = 'denied';
    }
  }

  async requestPermission(): Promise<boolean> {
    console.log('[WebToNative] Requesting notification permission');
    
    if (this.isWebToNative) {
      try {
        // For WebToNative, use native permission request
        if (typeof (window as any).WebToNative?.requestNotificationPermission === 'function') {
          const result = await (window as any).WebToNative.requestNotificationPermission();
          this.notificationPermission = result ? 'granted' : 'denied';
          return result;
        }
        
        // Fallback to standard web API
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          this.notificationPermission = permission;
          return permission === 'granted';
        }
        
        // If no notification API available, show toast message
        toast.info('Notifications will be handled by your device settings');
        this.notificationPermission = 'granted'; // Assume granted for mobile
        return true;
      } catch (error) {
        console.error('[WebToNative] Permission request failed:', error);
        this.notificationPermission = 'denied';
        return false;
      }
    } else {
      // Standard web permission request
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        this.notificationPermission = permission;
        return permission === 'granted';
      }
      return false;
    }
  }

  showNotification(title: string, options: NotificationOptions = {}): void {
    console.log('[WebToNative] Showing notification:', title);
    
    if (this.isWebToNative) {
      // Try WebToNative-specific notification method
      if (typeof (window as any).WebToNative?.showNotification === 'function') {
        (window as any).WebToNative.showNotification({
          title,
          body: options.body || '',
          icon: options.icon || '/icons/icon-192x192.png',
          tag: options.tag || 'journal-reminder'
        });
        return;
      }
      
      // Try React Native WebView postMessage
      if (typeof (window as any).ReactNativeWebView?.postMessage === 'function') {
        (window as any).ReactNativeWebView.postMessage(JSON.stringify({
          type: 'notification',
          title,
          body: options.body || '',
          icon: options.icon || '/icons/icon-192x192.png'
        }));
        return;
      }
    }
    
    // Fallback to standard web notification or toast
    if ('Notification' in window && this.notificationPermission === 'granted') {
      new Notification(title, {
        body: options.body,
        icon: options.icon || '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: options.tag || 'journal-reminder',
        requireInteraction: false,
        silent: false,
        ...options
      });
    } else {
      // Show as toast notification
      toast.info(`${title}${options.body ? ': ' + options.body : ''}`);
    }
  }

  scheduleNotification(title: string, body: string, scheduledTime: Date): void {
    const now = new Date();
    const delay = scheduledTime.getTime() - now.getTime();
    
    if (delay > 0) {
      setTimeout(() => {
        this.showNotification(title, { body });
      }, delay);
      
      console.log(`[WebToNative] Notification scheduled for ${scheduledTime.toLocaleString()}`);
    }
  }

  getPermissionStatus(): NotificationPermission {
    return this.notificationPermission;
  }

  isSupported(): boolean {
    return this.isWebToNative || 'Notification' in window;
  }

  isWebToNativeEnvironment(): boolean {
    return this.isWebToNative;
  }

  // Mobile-specific vibration support
  vibrate(pattern: number | number[] = 200): void {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }
}

// Export singleton instance
export const webToNativeNotificationService = WebToNativeNotificationService.getInstance();
