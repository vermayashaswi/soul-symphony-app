import { nativeIntegrationService } from './nativeIntegrationService';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface NotificationPermissionResult {
  granted: boolean;
  state: NotificationPermissionState;
  method: 'native' | 'web' | 'unsupported';
  details?: string;
}

interface PermissionDebugInfo {
  nativeSupported: boolean;
  webSupported: boolean;
  localNotificationsAvailable: boolean;
  pushNotificationsAvailable: boolean;
  currentPermission: NotificationPermissionState;
  platform: string;
  timestamp: number;
}

class EnhancedNotificationService {
  private static instance: EnhancedNotificationService;
  private debugEnabled = true;

  static getInstance(): EnhancedNotificationService {
    if (!EnhancedNotificationService.instance) {
      EnhancedNotificationService.instance = new EnhancedNotificationService();
    }
    return EnhancedNotificationService.instance;
  }

  private log(message: string, data?: any): void {
    if (this.debugEnabled) {
      console.log(`[EnhancedNotifications] ${message}`, data || '');
    }
  }

  private error(message: string, error?: any): void {
    console.error(`[EnhancedNotifications] ${message}`, error || '');
  }

  // Get comprehensive permission debug info
  private async getPermissionDebugInfo(): Promise<PermissionDebugInfo> {
    const isNative = nativeIntegrationService.isRunningNatively();
    const platform = nativeIntegrationService.getPlatform();
    
    const debugInfo: PermissionDebugInfo = {
      nativeSupported: isNative,
      webSupported: typeof window !== 'undefined' && 'Notification' in window,
      localNotificationsAvailable: isNative && nativeIntegrationService.isPluginAvailable('LocalNotifications'),
      pushNotificationsAvailable: isNative && nativeIntegrationService.isPluginAvailable('PushNotifications'),
      currentPermission: 'default',
      platform,
      timestamp: Date.now()
    };

    // Get current permission state
    try {
      if (debugInfo.nativeSupported && debugInfo.localNotificationsAvailable) {
        const localNotifications = nativeIntegrationService.getPlugin('LocalNotifications');
        if (localNotifications) {
          const result = await localNotifications.checkPermissions();
          debugInfo.currentPermission = this.mapNativePermission(result.display);
        }
      } else if (debugInfo.webSupported) {
        debugInfo.currentPermission = Notification.permission as NotificationPermissionState;
      } else {
        debugInfo.currentPermission = 'unsupported';
      }
    } catch (error) {
      this.error('Error getting current permission state:', error);
      debugInfo.currentPermission = 'default';
    }

    return debugInfo;
  }

  // Map native permission states to our standard states
  private mapNativePermission(nativeState: string): NotificationPermissionState {
    switch (nativeState) {
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
  }

  // Check current notification permission status
  public async checkPermissionStatus(): Promise<NotificationPermissionState> {
    try {
      this.log('Checking notification permission status');
      
      const debugInfo = await this.getPermissionDebugInfo();
      this.log('Permission debug info:', debugInfo);
      
      return debugInfo.currentPermission;
    } catch (error) {
      this.error('Error checking permission status:', error);
      return 'default';
    }
  }

  // Request notification permissions with proper native/web handling
  public async requestPermissions(): Promise<NotificationPermissionResult> {
    try {
      this.log('Starting permission request process');
      
      const debugInfo = await this.getPermissionDebugInfo();
      this.log('Initial permission state:', debugInfo);

      // Check if already granted
      if (debugInfo.currentPermission === 'granted') {
        this.log('Permission already granted');
        return {
          granted: true,
          state: 'granted',
          method: debugInfo.nativeSupported ? 'native' : 'web',
          details: 'Permission already granted'
        };
      }

      // Handle native environment
      if (debugInfo.nativeSupported) {
        return await this.requestNativePermissions(debugInfo);
      }

      // Handle web environment
      if (debugInfo.webSupported) {
        return await this.requestWebPermissions();
      }

      // Unsupported environment
      this.log('Notification permissions not supported in this environment');
      return {
        granted: false,
        state: 'unsupported',
        method: 'unsupported',
        details: 'Notifications not supported in this environment'
      };

    } catch (error) {
      this.error('Error requesting permissions:', error);
      return {
        granted: false,
        state: 'denied',
        method: 'unsupported',
        details: `Permission request failed: ${error}`
      };
    }
  }

  // Handle native permission requests
  private async requestNativePermissions(debugInfo: PermissionDebugInfo): Promise<NotificationPermissionResult> {
    this.log('Requesting native permissions');

    // CRITICAL: Request both LocalNotifications and PushNotifications in correct order
    const results: { local?: boolean; push?: boolean } = {};

    // 1. First request LocalNotifications permission
    if (debugInfo.localNotificationsAvailable) {
      try {
        this.log('Requesting LocalNotifications permission');
        const localNotifications = nativeIntegrationService.getPlugin('LocalNotifications');
        
        if (localNotifications) {
          const result = await localNotifications.requestPermissions();
          this.log('LocalNotifications permission result:', result);
          
          const granted = result.display === 'granted';
          results.local = granted;
          
          if (!granted) {
            this.log('LocalNotifications permission denied');
            return {
              granted: false,
              state: 'denied',
              method: 'native',
              details: 'Local notifications permission denied'
            };
          }
        }
      } catch (error) {
        this.error('Error requesting LocalNotifications permission:', error);
        results.local = false;
      }
    }

    // 2. Then request PushNotifications permission
    if (debugInfo.pushNotificationsAvailable) {
      try {
        this.log('Requesting PushNotifications permission');
        const pushNotifications = nativeIntegrationService.getPlugin('PushNotifications');
        
        if (pushNotifications) {
          const result = await pushNotifications.requestPermissions();
          this.log('PushNotifications permission result:', result);
          
          const granted = result.receive === 'granted';
          results.push = granted;
        }
      } catch (error) {
        this.error('Error requesting PushNotifications permission:', error);
        results.push = false;
      }
    }

    // Determine final result
    const hasLocalPermission = results.local !== false;
    const hasPushPermission = results.push !== false;
    const overallGranted = hasLocalPermission; // LocalNotifications is more important

    this.log('Native permission request completed:', {
      local: results.local,
      push: results.push,
      overallGranted
    });

    return {
      granted: overallGranted,
      state: overallGranted ? 'granted' : 'denied',
      method: 'native',
      details: `Local: ${results.local}, Push: ${results.push}`
    };
  }

  // Handle web permission requests
  private async requestWebPermissions(): Promise<NotificationPermissionResult> {
    this.log('Requesting web notification permission');

    try {
      const result = await Notification.requestPermission();
      this.log('Web permission result:', result);

      const granted = result === 'granted';

      return {
        granted,
        state: result as NotificationPermissionState,
        method: 'web',
        details: `Web permission: ${result}`
      };
    } catch (error) {
      this.error('Error requesting web permission:', error);
      return {
        granted: false,
        state: 'denied',
        method: 'web',
        details: `Web permission request failed: ${error}`
      };
    }
  }

  // Test notification delivery
  public async testNotification(): Promise<boolean> {
    try {
      this.log('Testing notification delivery');
      
      const permission = await this.checkPermissionStatus();
      if (permission !== 'granted') {
        this.log('Cannot test notification - permission not granted');
        return false;
      }

      const isNative = nativeIntegrationService.isRunningNatively();
      
      if (isNative) {
        return await this.sendNativeTestNotification();
      } else {
        return await this.sendWebTestNotification();
      }
    } catch (error) {
      this.error('Error testing notification:', error);
      return false;
    }
  }

  // Send native test notification
  private async sendNativeTestNotification(): Promise<boolean> {
    try {
      const localNotifications = nativeIntegrationService.getPlugin('LocalNotifications');
      
      if (!localNotifications) {
        this.log('LocalNotifications plugin not available');
        return false;
      }

      await localNotifications.schedule({
        notifications: [{
          title: 'SOULo Notifications',
          body: 'Notifications are working! You\'re all set up.',
          id: Date.now(),
          schedule: { at: new Date(Date.now() + 1000) }
        }]
      });

      this.log('Native test notification scheduled');
      return true;
    } catch (error) {
      this.error('Error sending native test notification:', error);
      return false;
    }
  }

  // Send web test notification
  private async sendWebTestNotification(): Promise<boolean> {
    try {
      new Notification('SOULo Notifications', {
        body: 'Notifications are working! You\'re all set up.',
        icon: '/favicon.ico'
      });

      this.log('Web test notification sent');
      return true;
    } catch (error) {
      this.error('Error sending web test notification:', error);
      return false;
    }
  }

  // Get comprehensive permission status info for debugging
  public async getPermissionInfo(): Promise<PermissionDebugInfo> {
    return await this.getPermissionDebugInfo();
  }

  // Enable/disable debug logging
  public setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    this.log(`Debug logging ${enabled ? 'enabled' : 'disabled'}`);
  }
}

export const enhancedNotificationService = EnhancedNotificationService.getInstance();