/**
 * Mobile-optimized notification service that handles platform-specific limitations
 * and provides enhanced guidance for mobile browsers and PWAs
 */

import { Capacitor } from '@capacitor/core';

export interface MobileNotificationResult {
  success: boolean;
  requiresPWA?: boolean;
  platformLimitation?: string;
  userGuidance?: string;
  error?: string;
}

export interface MobileCapabilities {
  webNotificationsSupported: boolean;
  isIOSSafari: boolean;
  isAndroidChrome: boolean;
  isWebView: boolean;
  isPWA: boolean;
  requiresPWAInstall: boolean;
}

class MobileNotificationService {
  private static instance: MobileNotificationService;

  static getInstance(): MobileNotificationService {
    if (!MobileNotificationService.instance) {
      MobileNotificationService.instance = new MobileNotificationService();
    }
    return MobileNotificationService.instance;
  }

  private log(message: string, data?: any): void {
    console.log(`[MobileNotificationService] ${message}`, data);
  }

  private error(message: string, error?: any): void {
    console.error(`[MobileNotificationService] ${message}`, error);
  }

  // Detect mobile platform capabilities
  detectMobileCapabilities(): MobileCapabilities {
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOSSafari = /iphone|ipad|ipod/.test(userAgent) && /safari/.test(userAgent) && !/crios|fxios/.test(userAgent);
    const isAndroidChrome = /android/.test(userAgent) && /chrome/.test(userAgent);
    const isWebView = Capacitor.isNativePlatform();
    
    // Check if running as PWA
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  (window.navigator as any).standalone === true ||
                  window.location.search.includes('utm_source=pwa');

    const webNotificationsSupported = 'Notification' in window;
    
    // iOS Safari requires PWA for web notifications (iOS 16.4+)
    const requiresPWAInstall = isIOSSafari && !isPWA && webNotificationsSupported;

    return {
      webNotificationsSupported,
      isIOSSafari,
      isAndroidChrome,
      isWebView,
      isPWA,
      requiresPWAInstall
    };
  }

  // Check if notifications can work on current platform
  async checkNotificationCompatibility(): Promise<MobileNotificationResult> {
    const capabilities = this.detectMobileCapabilities();
    
    this.log('Checking notification compatibility', capabilities);

    // If in Capacitor WebView, use native notifications
    if (capabilities.isWebView) {
      return {
        success: true,
        userGuidance: 'Using native mobile notifications'
      };
    }

    // If web notifications not supported
    if (!capabilities.webNotificationsSupported) {
      return {
        success: false,
        platformLimitation: 'Web notifications not supported on this browser',
        userGuidance: 'Please use a modern browser or install the app'
      };
    }

    // iOS Safari specific handling
    if (capabilities.isIOSSafari) {
      if (!capabilities.isPWA) {
        return {
          success: false,
          requiresPWA: true,
          platformLimitation: 'iOS Safari requires PWA installation for notifications',
          userGuidance: 'To enable notifications on iOS: 1) Tap the Share button, 2) Select "Add to Home Screen", 3) Open the app from your home screen'
        };
      }
      // PWA on iOS
      return {
        success: true,
        userGuidance: 'PWA notifications supported on iOS 16.4+'
      };
    }

    // Android Chrome
    if (capabilities.isAndroidChrome) {
      // Android Chrome supports notifications but often blocks them for non-installed sites
      const permission = Notification.permission;
      if (permission === 'denied') {
        return {
          success: false,
          platformLimitation: 'Notifications blocked by browser',
          userGuidance: 'Enable notifications in browser settings or install as PWA for better reliability'
        };
      }
      
      return {
        success: true,
        userGuidance: capabilities.isPWA ? 'PWA notifications supported' : 'Browser notifications supported (PWA recommended for reliability)'
      };
    }

    // Other browsers
    return {
      success: true,
      userGuidance: 'Web notifications should work on this browser'
    };
  }

  // Enhanced test notification with mobile-specific handling
  async testNotification(): Promise<MobileNotificationResult> {
    this.log('Testing mobile notification');
    
    const compatibility = await this.checkNotificationCompatibility();
    
    if (!compatibility.success) {
      return compatibility;
    }

    try {
      const capabilities = this.detectMobileCapabilities();
      
      // Handle Capacitor WebView
      if (capabilities.isWebView) {
        return await this.testNativeNotification();
      }

      // Handle web notifications
      return await this.testWebNotification(capabilities);
      
    } catch (error) {
      this.error('Test notification failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testNativeNotification(): Promise<MobileNotificationResult> {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      const permissions = await LocalNotifications.checkPermissions();
      if (permissions.display !== 'granted') {
        const requested = await LocalNotifications.requestPermissions();
        if (requested.display !== 'granted') {
          return {
            success: false,
            platformLimitation: 'Native notification permissions denied',
            userGuidance: 'Please enable notifications in your device settings'
          };
        }
      }

      await LocalNotifications.schedule({
        notifications: [{
          id: 99998,
          title: 'Mobile Test Notification 📱',
          body: 'Your mobile notifications are working perfectly!',
          schedule: { at: new Date(Date.now() + 1000) }
        }]
      });

      return {
        success: true,
        userGuidance: 'Native mobile notification sent!'
      };
    } catch (error) {
      this.error('Native test failed:', error);
      return {
        success: false,
        error: 'Native notification test failed'
      };
    }
  }

  private async testWebNotification(capabilities: MobileCapabilities): Promise<MobileNotificationResult> {
    // Check permission
    if (Notification.permission === 'denied') {
      return {
        success: false,
        platformLimitation: 'Notification permission denied',
        userGuidance: capabilities.isPWA ? 
          'Enable notifications in your device settings for this app' :
          'Enable notifications in browser settings or install as PWA'
      };
    }

    // Request permission if needed
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return {
          success: false,
          platformLimitation: 'Notification permission denied',
          userGuidance: 'Please allow notifications when prompted'
        };
      }
    }

    try {
      // Create test notification
      const notification = new Notification('Mobile Test Notification 📱', {
        body: capabilities.isPWA ? 
          'Your PWA notifications are working!' : 
          'Your web notifications are working!',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'mobile-test',
        requireInteraction: false,
        silent: false
      });

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      // Platform-specific guidance
      let userGuidance = 'Web notification sent successfully!';
      if (capabilities.isIOSSafari && capabilities.isPWA) {
        userGuidance += ' (iOS PWA notifications work best when the app is in the foreground)';
      } else if (capabilities.isAndroidChrome && !capabilities.isPWA) {
        userGuidance += ' (Consider installing as PWA for more reliable notifications)';
      }

      return {
        success: true,
        userGuidance
      };
    } catch (error) {
      this.error('Web notification test failed:', error);
      
      // Provide platform-specific error guidance
      let userGuidance = 'Web notification failed. ';
      if (capabilities.isIOSSafari) {
        userGuidance += 'iOS notifications require PWA installation.';
      } else if (capabilities.isAndroidChrome) {
        userGuidance += 'Try enabling notifications in browser settings.';
      } else {
        userGuidance += 'Check browser notification settings.';
      }

      return {
        success: false,
        platformLimitation: 'Web notification API failed',
        userGuidance,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get platform-specific installation guidance
  getPWAInstallationGuidance(): string {
    const capabilities = this.detectMobileCapabilities();
    
    if (capabilities.isIOSSafari) {
      return 'To install on iOS: Tap the Share button (square with arrow) → "Add to Home Screen" → "Add"';
    } else if (capabilities.isAndroidChrome) {
      return 'To install on Android: Tap the menu (⋮) → "Add to Home Screen" → "Add"';
    } else {
      return 'Look for "Install App" or "Add to Home Screen" in your browser menu';
    }
  }

  // Check if current context supports reliable notifications
  async getReliabilityAssessment(): Promise<{
    reliable: boolean;
    recommendation: string;
    limitations: string[];
  }> {
    const capabilities = this.detectMobileCapabilities();
    const limitations: string[] = [];
    
    if (capabilities.isWebView) {
      return {
        reliable: true,
        recommendation: 'Native mobile notifications are the most reliable option',
        limitations: []
      };
    }

    if (capabilities.isIOSSafari && !capabilities.isPWA) {
      limitations.push('iOS Safari requires PWA installation for notifications');
      limitations.push('Notifications only work when app is in foreground on iOS');
      return {
        reliable: false,
        recommendation: 'Install as PWA for notification support',
        limitations
      };
    }

    if (capabilities.isAndroidChrome && !capabilities.isPWA) {
      limitations.push('Browser may block notifications for non-installed sites');
      limitations.push('Notifications may not persist across browser sessions');
      return {
        reliable: false,
        recommendation: 'Install as PWA for more reliable notifications',
        limitations
      };
    }

    if (capabilities.isPWA) {
      return {
        reliable: true,
        recommendation: 'PWA notifications are reliable on your platform',
        limitations: []
      };
    }

    return {
      reliable: true,
      recommendation: 'Web notifications should work on your browser',
      limitations: []
    };
  }
}

export const mobileNotificationService = MobileNotificationService.getInstance();
