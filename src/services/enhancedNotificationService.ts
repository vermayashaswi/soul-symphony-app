
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
  private debugEnabled = true; // Enable debug by default for mobile development

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
      this.log(`Native context check: ${isNative}`);
      return isNative;
    } catch (error) {
      this.error('Error checking native context:', error);
      return false;
    }
  }

  private async arePluginsAvailable(): Promise<{ local: boolean; push: boolean }> {
    try {
      const { Capacitor } = await import('@capacitor/core');
      
      if (!Capacitor.isNativePlatform()) {
        this.log('Not on native platform, plugins not available');
        return { local: false, push: false };
      }

      // Check plugin availability by attempting to import them
      let localAvailable = false;
      let pushAvailable = false;
      
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        // Try to call a simple method to verify the plugin is actually available
        await LocalNotifications.checkPermissions();
        localAvailable = true;
        this.log('LocalNotifications plugin is available and functional');
      } catch (localError) {
        this.log('LocalNotifications plugin not available:', localError);
        localAvailable = false;
      }
      
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        // Try to call a simple method to verify the plugin is actually available
        await PushNotifications.checkPermissions();
        pushAvailable = true;
        this.log('PushNotifications plugin is available and functional');
      } catch (pushError) {
        this.log('PushNotifications plugin not available:', pushError);
        pushAvailable = false;
      }
      
      this.log('Plugin availability check complete:', { local: localAvailable, push: pushAvailable });
      
      return { local: localAvailable, push: pushAvailable };
    } catch (error) {
      this.error('Error checking plugin availability:', error);
      return { local: false, push: false };
    }
  }

  async checkPermissionStatus(): Promise<NotificationPermissionState> {
    this.log('Starting permission status check');
    
    try {
      const isNative = await this.isNativeContext();
      
      if (isNative) {
        this.log('Native platform detected, checking native permissions');
        
        const pluginAvailability = await this.arePluginsAvailable();
        
        if (!pluginAvailability.local && !pluginAvailability.push) {
          this.error('No notification plugins available');
          return 'unsupported';
        }
        
        // Prefer LocalNotifications for local notifications
        if (pluginAvailability.local) {
          try {
            const { LocalNotifications } = await import('@capacitor/local-notifications');
            const localStatus = await LocalNotifications.checkPermissions();
            this.log('LocalNotifications permission status:', localStatus);
            
            if (localStatus.display === 'granted') {
              return 'granted';
            } else if (localStatus.display === 'denied') {
              return 'denied';
            } else {
              return 'default';
            }
          } catch (localError) {
            this.error('LocalNotifications check failed:', localError);
          }
        }
        
        // Fallback to PushNotifications
        if (pluginAvailability.push) {
          try {
            const { PushNotifications } = await import('@capacitor/push-notifications');
            const pushStatus = await PushNotifications.checkPermissions();
            this.log('PushNotifications permission status:', pushStatus);
            
            if (pushStatus.receive === 'granted') {
              return 'granted';
            } else if (pushStatus.receive === 'denied') {
              return 'denied';
            } else {
              return 'default';
            }
          } catch (pushError) {
            this.error('PushNotifications check failed:', pushError);
          }
        }
        
        this.error('All native permission checks failed');
        return 'unsupported';
      } else {
        this.log('Web platform detected, checking web permissions');
        
        if (!('Notification' in window)) {
          this.log('Web Notifications API not supported');
          return 'unsupported';
        }
        
        const permission = Notification.permission;
        this.log('Web notification permission:', permission);
        
        return permission as NotificationPermissionState;
      }
    } catch (error) {
      this.error('Error checking permission status:', error);
      return 'unsupported';
    }
  }

  async requestPermissions(): Promise<NotificationPermissionResult> {
    this.log('Permission request initiated');
    
    try {
      const debugInfo = await this.getPermissionInfo();
      this.log('Pre-request debug info:', debugInfo);

      const isNative = await this.isNativeContext();
      
      if (isNative) {
        this.log('Requesting native permissions');
        return await this.requestNativePermissions(debugInfo);
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

  private async requestNativePermissions(debugInfo: PermissionDebugInfo): Promise<NotificationPermissionResult> {
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
