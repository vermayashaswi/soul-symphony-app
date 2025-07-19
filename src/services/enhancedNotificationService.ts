
export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export interface NotificationPermissionResult {
  granted: boolean;
  state: NotificationPermissionState;
  plugin?: string;
  error?: string;
}

class EnhancedNotificationService {
  private static instance: EnhancedNotificationService;
  private debugEnabled = true;
  private permissionCheckCache: { state: NotificationPermissionState; timestamp: number } | null = null;
  private readonly CACHE_DURATION_MS = 3000; // Cache for 3 seconds

  static getInstance(): EnhancedNotificationService {
    if (!EnhancedNotificationService.instance) {
      EnhancedNotificationService.instance = new EnhancedNotificationService();
    }
    return EnhancedNotificationService.instance;
  }

  private log(message: string, data?: any): void {
    if (this.debugEnabled) {
      console.log(`[EnhancedNotificationService] ${message}`, data);
    }
  }

  private error(message: string, error?: any): void {
    console.error(`[EnhancedNotificationService] ${message}`, error);
  }

  private async isNativeContext(): Promise<boolean> {
    try {
      const { Capacitor } = await import('@capacitor/core');
      return Capacitor.isNativePlatform();
    } catch (error) {
      return false;
    }
  }

  private async arePluginsAvailable(): Promise<{ local: boolean; push: boolean }> {
    try {
      const { Capacitor } = await import('@capacitor/core');
      
      if (!Capacitor.isNativePlatform()) {
        return { local: false, push: false };
      }

      let localAvailable = false;
      let pushAvailable = false;
      
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        await LocalNotifications.checkPermissions();
        localAvailable = true;
      } catch {
        localAvailable = false;
      }
      
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        await PushNotifications.checkPermissions();
        pushAvailable = true;
      } catch {
        pushAvailable = false;
      }
      
      return { local: localAvailable, push: pushAvailable };
    } catch (error) {
      return { local: false, push: false };
    }
  }

  // Check permission status without requesting
  async checkPermissionStatus(): Promise<NotificationPermissionState> {
    // Use cache to avoid excessive checks
    if (this.permissionCheckCache && 
        (Date.now() - this.permissionCheckCache.timestamp) < this.CACHE_DURATION_MS) {
      return this.permissionCheckCache.state;
    }

    this.log('Checking permission status (passive)');
    
    try {
      const isNative = await this.isNativeContext();
      
      if (isNative) {
        const result = await this.checkNativePermissions();
        this.permissionCheckCache = { state: result, timestamp: Date.now() };
        return result;
      } else {
        const result = await this.checkWebPermissions();
        this.permissionCheckCache = { state: result, timestamp: Date.now() };
        return result;
      }
    } catch (error) {
      this.error('Error checking permission status:', error);
      const result: NotificationPermissionState = 'unsupported';
      this.permissionCheckCache = { state: result, timestamp: Date.now() };
      return result;
    }
  }

  private async checkNativePermissions(): Promise<NotificationPermissionState> {
    const pluginAvailability = await this.arePluginsAvailable();
    
    if (!pluginAvailability.local && !pluginAvailability.push) {
      return 'unsupported';
    }
    
    // Check LocalNotifications first
    if (pluginAvailability.local) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const status = await LocalNotifications.checkPermissions();
        
        if (status.display === 'granted') return 'granted';
        if (status.display === 'denied') return 'denied';
        return 'default';
      } catch (error) {
        this.log('LocalNotifications check failed:', error);
      }
    }
    
    // Fallback to PushNotifications
    if (pluginAvailability.push) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const status = await PushNotifications.checkPermissions();
        
        if (status.receive === 'granted') return 'granted';
        if (status.receive === 'denied') return 'denied';
        return 'default';
      } catch (error) {
        this.log('PushNotifications check failed:', error);
      }
    }
    
    return 'unsupported';
  }

  private async checkWebPermissions(): Promise<NotificationPermissionState> {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    
    return Notification.permission as NotificationPermissionState;
  }

  // Request permissions when user explicitly wants them
  async requestPermissions(): Promise<NotificationPermissionResult> {
    this.log('User explicitly requesting notification permissions');
    
    // Clear cache since we're making changes
    this.permissionCheckCache = null;
    
    try {
      const isNative = await this.isNativeContext();
      
      if (isNative) {
        return await this.requestNativePermissions();
      } else {
        return await this.requestWebPermissions();
      }
    } catch (error) {
      this.error('Error requesting permissions:', error);
      return {
        granted: false,
        state: 'denied',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async requestNativePermissions(): Promise<NotificationPermissionResult> {
    this.log('Requesting native notification permissions');
    
    const pluginAvailability = await this.arePluginsAvailable();
    
    if (!pluginAvailability.local && !pluginAvailability.push) {
      return {
        granted: false,
        state: 'unsupported',
        error: 'No notification plugins available'
      };
    }
    
    // Try LocalNotifications first
    if (pluginAvailability.local) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const result = await LocalNotifications.requestPermissions();
        
        if (result.display === 'granted') {
          return { granted: true, state: 'granted', plugin: 'LocalNotifications' };
        }
        if (result.display === 'denied') {
          return { granted: false, state: 'denied', plugin: 'LocalNotifications' };
        }
      } catch (error) {
        this.error('LocalNotifications request failed:', error);
      }
    }
    
    // Try PushNotifications as fallback
    if (pluginAvailability.push) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const result = await PushNotifications.requestPermissions();
        
        if (result.receive === 'granted') {
          return { granted: true, state: 'granted', plugin: 'PushNotifications' };
        }
        if (result.receive === 'denied') {
          return { granted: false, state: 'denied', plugin: 'PushNotifications' };
        }
      } catch (error) {
        this.error('PushNotifications request failed:', error);
      }
    }
    
    return {
      granted: false,
      state: 'denied',
      error: 'All permission requests failed'
    };
  }

  private async requestWebPermissions(): Promise<NotificationPermissionResult> {
    this.log('Requesting web notification permissions');
    
    try {
      if (!('Notification' in window)) {
        return {
          granted: false,
          state: 'unsupported',
          error: 'Notifications not supported'
        };
      }

      const result = await Notification.requestPermission();
      
      return {
        granted: result === 'granted',
        state: result as NotificationPermissionState,
        plugin: 'Web'
      };
    } catch (error) {
      this.error('Web permission request failed:', error);
      return {
        granted: false,
        state: 'denied',
        error: error instanceof Error ? error.message : 'Permission request failed'
      };
    }
  }

  // Test notification functionality
  async testNotification(): Promise<boolean> {
    try {
      this.log('Testing notification');
      
      const permission = await this.checkPermissionStatus();
      if (permission !== 'granted') {
        this.log('Cannot test - permission not granted:', permission);
        return false;
      }

      const isNative = await this.isNativeContext();
      
      if (isNative) {
        return await this.sendNativeTest();
      } else {
        return this.sendWebTest();
      }
    } catch (error) {
      this.error('Error testing notification:', error);
      return false;
    }
  }

  private async sendNativeTest(): Promise<boolean> {
    try {
      const pluginAvailability = await this.arePluginsAvailable();
      
      if (pluginAvailability.local) {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        
        await LocalNotifications.schedule({
          notifications: [{
            title: 'SOULo Test Notification',
            body: 'Notifications are working perfectly!',
            id: 99999,
            schedule: { at: new Date(Date.now() + 1000) }
          }]
        });
        
        this.log('Native test notification scheduled');
        return true;
      }
      
      return false;
    } catch (error) {
      this.error('Native test failed:', error);
      return false;
    }
  }

  private sendWebTest(): boolean {
    try {
      new Notification('SOULo Test Notification', {
        body: 'Notifications are working perfectly!',
        icon: '/favicon.ico'
      });
      
      this.log('Web test notification sent');
      return true;
    } catch (error) {
      this.error('Web test failed:', error);
      return false;
    }
  }

  // Get comprehensive permission info for debugging
  async getPermissionInfo(): Promise<any> {
    try {
      const isNative = await this.isNativeContext();
      const pluginAvailability = await this.arePluginsAvailable();
      const currentPermission = await this.checkPermissionStatus();
      
      const info: any = {
        isNative,
        pluginAvailability,
        currentPermission,
        webSupported: 'Notification' in window,
        timestamp: new Date().toISOString()
      };
      
      if (isNative) {
        // Add native-specific debug info
        try {
          if (pluginAvailability.local) {
            const { LocalNotifications } = await import('@capacitor/local-notifications');
            const localStatus = await LocalNotifications.checkPermissions();
            info.localNotificationsStatus = localStatus;
          }
          
          if (pluginAvailability.push) {
            const { PushNotifications } = await import('@capacitor/push-notifications');
            const pushStatus = await PushNotifications.checkPermissions();
            info.pushNotificationsStatus = pushStatus;
          }
        } catch (error) {
          info.nativeDebugError = error instanceof Error ? error.message : 'Unknown error';
        }
      } else {
        // Add web-specific debug info
        info.webNotificationPermission = 'Notification' in window ? Notification.permission : 'not-available';
      }
      
      return info;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
  }
}

export const enhancedNotificationService = EnhancedNotificationService.getInstance();
