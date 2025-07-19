export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export interface NotificationPermissionResult {
  granted: boolean;
  state: NotificationPermissionState;
  plugin?: string;
  error?: string;
}

export interface PermissionDebugInfo {
  isNative: boolean;
  platform: string;
  nativeStatus: any;
  webStatus: any;
  pluginErrors: Array<{ plugin: string; error: string }>;
  timestamp: string;
}

class EnhancedNotificationService {
  private static instance: EnhancedNotificationService;
  private debugEnabled = true;
  private permissionCheckCache: { state: NotificationPermissionState; timestamp: number } | null = null;
  private readonly CACHE_DURATION_MS = 5000; // Cache permission checks for 5 seconds

  static getInstance(): EnhancedNotificationService {
    if (!EnhancedNotificationService.instance) {
      EnhancedNotificationService.instance = new EnhancedNotificationService();
    }
    return EnhancedNotificationService.instance;
  }

  private async log(message: string, data?: any): Promise<void> {
    if (this.debugEnabled) {
      console.log(`[EnhancedNotificationService] ${message}`, data);
    }
  }

  private async error(message: string, error?: any): Promise<void> {
    console.error(`[EnhancedNotificationService] ${message}`, error);
  }

  private async isNativeContext(): Promise<boolean> {
    try {
      const { Capacitor } = await import('@capacitor/core');
      const isNative = Capacitor.isNativePlatform();
      return isNative;
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
      } catch (localError) {
        localAvailable = false;
      }
      
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        await PushNotifications.checkPermissions();
        pushAvailable = true;
      } catch (pushError) {
        pushAvailable = false;
      }
      
      return { local: localAvailable, push: pushAvailable };
    } catch (error) {
      return { local: false, push: false };
    }
  }

  // PASSIVE permission checking - does not trigger permission requests
  async checkPermissionStatus(): Promise<NotificationPermissionState> {
    // Use cache to avoid excessive permission checks
    if (this.permissionCheckCache && 
        (Date.now() - this.permissionCheckCache.timestamp) < this.CACHE_DURATION_MS) {
      this.log('Using cached permission status:', this.permissionCheckCache.state);
      return this.permissionCheckCache.state;
    }

    this.log('Checking permission status (passive check only)');
    
    try {
      const isNative = await this.isNativeContext();
      
      if (isNative) {
        this.log('Native platform - checking native permissions passively');
        
        const pluginAvailability = await this.arePluginsAvailable();
        
        if (!pluginAvailability.local && !pluginAvailability.push) {
          this.log('No notification plugins available');
          const result = 'unsupported';
          this.permissionCheckCache = { state: result, timestamp: Date.now() };
          return result;
        }
        
        // Check LocalNotifications first (preferred)
        if (pluginAvailability.local) {
          try {
            const { LocalNotifications } = await import('@capacitor/local-notifications');
            const localStatus = await LocalNotifications.checkPermissions();
            this.log('LocalNotifications permission check result:', localStatus);
            
            let result: NotificationPermissionState;
            if (localStatus.display === 'granted') {
              result = 'granted';
            } else if (localStatus.display === 'denied') {
              result = 'denied';
            } else {
              result = 'default';
            }
            
            this.permissionCheckCache = { state: result, timestamp: Date.now() };
            return result;
          } catch (localError) {
            this.log('LocalNotifications check failed:', localError);
          }
        }
        
        // Fallback to PushNotifications
        if (pluginAvailability.push) {
          try {
            const { PushNotifications } = await import('@capacitor/push-notifications');
            const pushStatus = await PushNotifications.checkPermissions();
            this.log('PushNotifications permission check result:', pushStatus);
            
            let result: NotificationPermissionState;
            if (pushStatus.receive === 'granted') {
              result = 'granted';
            } else if (pushStatus.receive === 'denied') {
              result = 'denied';
            } else {
              result = 'default';
            }
            
            this.permissionCheckCache = { state: result, timestamp: Date.now() };
            return result;
          } catch (pushError) {
            this.log('PushNotifications check failed:', pushError);
          }
        }
        
        const result = 'unsupported';
        this.permissionCheckCache = { state: result, timestamp: Date.now() };
        return result;
      } else {
        this.log('Web platform - checking web notification permission');
        
        if (!('Notification' in window)) {
          const result = 'unsupported';
          this.permissionCheckCache = { state: result, timestamp: Date.now() };
          return result;
        }
        
        const permission = Notification.permission as NotificationPermissionState;
        this.log('Web notification permission:', permission);
        
        this.permissionCheckCache = { state: permission, timestamp: Date.now() };
        return permission;
      }
    } catch (error) {
      this.error('Error checking permission status:', error);
      const result = 'unsupported';
      this.permissionCheckCache = { state: result, timestamp: Date.now() };
      return result;
    }
  }

  // ACTIVE permission requesting - only call when user explicitly wants notifications
  async requestPermissions(): Promise<NotificationPermissionResult> {
    this.log('EXPLICIT permission request initiated by user action');
    
    // Clear cache since we're about to make changes
    this.permissionCheckCache = null;
    
    try {
      const debugInfo = await this.getPermissionInfo();
      this.log('Pre-request debug info:', debugInfo);

      const isNative = await this.isNativeContext();
      
      if (isNative) {
        this.log('Requesting native permissions');
        return await this.requestNativePermissions();
      } else {
        this.log('Requesting web permissions');
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
    this.log('Starting native permission request sequence');
    
    const pluginAvailability = await this.arePluginsAvailable();
    
    if (!pluginAvailability.local && !pluginAvailability.push) {
      this.error('No notification plugins available for permission request');
      return {
        granted: false,
        state: 'unsupported',
        error: 'No notification plugins registered'
      };
    }
    
    // Try LocalNotifications first (preferred for journal reminders)
    if (pluginAvailability.local) {
      try {
        this.log('Attempting LocalNotifications permission request');
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        
        const localResult = await LocalNotifications.requestPermissions();
        this.log('LocalNotifications request result:', localResult);
        
        if (localResult.display === 'granted') {
          this.log('LocalNotifications permission granted');
          return {
            granted: true,
            state: 'granted',
            plugin: 'LocalNotifications'
          };
        } else if (localResult.display === 'denied') {
          this.log('LocalNotifications permission denied by user');
          return {
            granted: false,
            state: 'denied',
            plugin: 'LocalNotifications'
          };
        }
      } catch (localError) {
        this.error('LocalNotifications request failed:', localError);
      }
    }
    
    // Try PushNotifications as fallback
    if (pluginAvailability.push) {
      try {
        this.log('Attempting PushNotifications permission request');
        const { PushNotifications } = await import('@capacitor/push-notifications');
        
        const pushResult = await PushNotifications.requestPermissions();
        this.log('PushNotifications request result:', pushResult);
        
        if (pushResult.receive === 'granted') {
          this.log('PushNotifications permission granted');
          return {
            granted: true,
            state: 'granted',
            plugin: 'PushNotifications'
          };
        } else if (pushResult.receive === 'denied') {
          this.log('PushNotifications permission denied by user');
          return {
            granted: false,
            state: 'denied',
            plugin: 'PushNotifications'
          };
        }
      } catch (pushError) {
        this.error('PushNotifications request failed:', pushError);
      }
    }
    
    this.error('All native permission requests failed or were denied');
    return {
      granted: false,
      state: 'denied',
      error: 'All notification permission requests failed'
    };
  }

  private async requestWebPermissions(): Promise<NotificationPermissionResult> {
    this.log('Requesting web notification permission');
    
    try {
      const result = await Notification.requestPermission();
      this.log('Web permission result:', result);
      
      return {
        granted: result === 'granted',
        state: result as NotificationPermissionState,
        plugin: 'Web'
      };
    } catch (error) {
      this.error('Error requesting web permission:', error);
      return {
        granted: false,
        state: 'denied',
        error: error instanceof Error ? error.message : 'Web permission request failed'
      }; 
    }
  }

  async testNotification(): Promise<boolean> {
    try {
      this.log('Testing notification delivery');
      
      const permission = await this.checkPermissionStatus();
      if (permission !== 'granted') {
        this.log('Cannot test notification - permission not granted:', permission);
        return false;
      }

      const isNative = await this.isNativeContext();
      
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

  async getPermissionInfo(): Promise<PermissionDebugInfo> {
    try {
      const isNative = await this.isNativeContext();
      const { Capacitor } = await import('@capacitor/core');
      const platform = Capacitor.getPlatform();
      
      let nativeStatus = null;
      let webStatus = null;
      let pluginErrors: any[] = [];
      
      if (isNative) {
        const pluginAvailability = await this.arePluginsAvailable();
        
        // Check LocalNotifications
        if (pluginAvailability.local) {
          try {
            const { LocalNotifications } = await import('@capacitor/local-notifications');
            const localStatus = await LocalNotifications.checkPermissions();
            nativeStatus = {
              ...nativeStatus,
              localNotifications: localStatus,
              localNotificationsAvailable: true
            };
          } catch (error) {
            pluginErrors.push({ plugin: 'LocalNotifications', error: error instanceof Error ? error.message : 'Unknown error' });
          }
        } else {
          nativeStatus = {
            ...nativeStatus,
            localNotificationsAvailable: false
          };
          pluginErrors.push({ plugin: 'LocalNotifications', error: 'Plugin not registered' });
        }
        
        // Check PushNotifications
        if (pluginAvailability.push) {
          try {
            const { PushNotifications } = await import('@capacitor/push-notifications');
            const pushStatus = await PushNotifications.checkPermissions();
            nativeStatus = {
              ...nativeStatus,
              pushNotifications: pushStatus,
              pushNotificationsAvailable: true
            };
          } catch (error) {
            pluginErrors.push({ plugin: 'PushNotifications', error: error instanceof Error ? error.message : 'Unknown error' });
          }
        } else {
          nativeStatus = {
            ...nativeStatus,
            pushNotificationsAvailable: false
          };
          pluginErrors.push({ plugin: 'PushNotifications', error: 'Plugin not registered' });
        }
      } else {
        // Web platform
        webStatus = {
          supported: 'Notification' in window,
          permission: 'Notification' in window ? Notification.permission : 'unsupported'
        };
      }
      
      const debugInfo = {
        isNative,
        platform,
        nativeStatus,
        webStatus,
        pluginErrors,
        timestamp: new Date().toISOString()
      };
      
      this.log('Generated debug info:', debugInfo);
      return debugInfo;
    } catch (error) {
      this.error('Error getting permission info:', error);
      return {
        isNative: false,
        platform: 'unknown',
        nativeStatus: null,
        webStatus: null,
        pluginErrors: [{ plugin: 'System', error: error instanceof Error ? error.message : 'Unknown error' }],
        timestamp: new Date().toISOString()
      };
    }
  }

  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    this.log(`Debug logging ${enabled ? 'enabled' : 'disabled'}`);
  }

  private async sendNativeTestNotification(): Promise<boolean> {
    try {
      const pluginAvailability = await this.arePluginsAvailable();
      
      if (pluginAvailability.local) {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        
        await LocalNotifications.schedule({
          notifications: [{
            title: 'SOULo Notifications',
            body: 'Notifications are working! You\'re all set up.',
            id: Date.now(),
            schedule: { at: new Date(Date.now() + 1000) }
          }]
        });
        
        this.log('Native test notification scheduled via LocalNotifications');
        return true;
      }
      
      this.log('No available plugins for native test notification');
      return false;
    } catch (error) {
      this.error('Error sending native test notification:', error);
      return false;
    }
  }

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
}

export const enhancedNotificationService = EnhancedNotificationService.getInstance();
