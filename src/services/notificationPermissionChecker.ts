import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

/**
 * Non-intrusive permission checker that only checks status without requesting
 * Used to avoid triggering permission popups on page load
 */
class NotificationPermissionChecker {
  private static instance: NotificationPermissionChecker;
  private isNative = false;
  private isInitialized = false;

  static getInstance(): NotificationPermissionChecker {
    if (!NotificationPermissionChecker.instance) {
      NotificationPermissionChecker.instance = new NotificationPermissionChecker();
    }
    return NotificationPermissionChecker.instance;
  }

  private async initialize() {
    if (this.isInitialized) return;
    
    this.isNative = Capacitor.isNativePlatform();
    this.isInitialized = true;
    
    console.log('[NotificationPermissionChecker] Initialized. Native:', this.isNative);
  }

  /**
   * Check current permission status WITHOUT requesting
   * This method will never trigger a permission popup
   */
  async checkPermissionStatus(): Promise<NotificationPermissionState> {
    await this.initialize();

    try {
      if (this.isNative) {
        // For native, check current status without requesting
        const status = await LocalNotifications.checkPermissions();
        
        switch (status.display) {
          case 'granted':
            return 'granted';
          case 'denied':
            return 'denied';
          case 'prompt':
          case 'prompt-with-rationale':
            return 'default';
          default:
            return 'default';
        }
      } else {
        // For web, check current status
        if (!('Notification' in window)) {
          return 'unsupported';
        }

        switch (Notification.permission) {
          case 'granted':
            return 'granted';
          case 'denied':
            return 'denied';
          case 'default':
            return 'default';
          default:
            return 'unsupported';
        }
      }
    } catch (error) {
      console.error('[NotificationPermissionChecker] Error checking permission status:', error);
      return 'unsupported';
    }
  }

  /**
   * Request permissions - this WILL trigger a popup
   * Only call this when user explicitly takes an action
   */
  async requestPermissions(): Promise<{ granted: boolean; state: NotificationPermissionState }> {
    await this.initialize();

    try {
      if (this.isNative) {
        const result = await LocalNotifications.requestPermissions();
        const granted = result.display === 'granted';
        
        return {
          granted,
          state: granted ? 'granted' : 'denied'
        };
      } else {
        if (!('Notification' in window)) {
          return { granted: false, state: 'unsupported' };
        }

        const permission = await Notification.requestPermission();
        const granted = permission === 'granted';
        
        return {
          granted,
          state: permission as NotificationPermissionState
        };
      }
    } catch (error) {
      console.error('[NotificationPermissionChecker] Error requesting permissions:', error);
      return { granted: false, state: 'denied' };
    }
  }

  /**
   * Get platform information for debugging
   */
  getPlatformInfo() {
    return {
      isNative: this.isNative,
      platform: Capacitor.getPlatform(),
      isWebView: Capacitor.getPlatform() === 'web' && 
                  (window.navigator.userAgent.includes('wv') || 
                   window.navigator.userAgent.includes('Android'))
    };
  }
}

export const notificationPermissionChecker = NotificationPermissionChecker.getInstance();