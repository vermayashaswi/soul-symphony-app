
/**
 * Native Permission Service
 * Handles permission requests for both web and native environments
 */

import { webToNativeDetection } from './webToNativeDetectionService';

export type PermissionStatus = 'granted' | 'denied' | 'default' | 'prompt';

interface PermissionResult {
  status: PermissionStatus;
  canRequest: boolean;
  message?: string;
}

class NativePermissionService {
  async requestNotificationPermission(): Promise<PermissionResult> {
    const deviceInfo = await webToNativeDetection.getDeviceInfo();

    if (deviceInfo.isNative) {
      return this.requestNativeNotificationPermission();
    } else {
      return this.requestWebNotificationPermission();
    }
  }

  private async requestNativeNotificationPermission(): Promise<PermissionResult> {
    try {
      // Use eval to prevent Vite from trying to resolve the import at build time
      const dynamicImport = new Function('specifier', 'return import(specifier)');
      const { LocalNotifications } = await dynamicImport('@capacitor/local-notifications');

      const result = await LocalNotifications.requestPermissions();
      
      console.log('Native notification permission result:', result);

      return {
        status: result.display === 'granted' ? 'granted' : 'denied',
        canRequest: result.display !== 'denied',
        message: result.display === 'granted' 
          ? 'Native notifications enabled' 
          : 'Native notification permission denied'
      };
    } catch (error) {
      console.error('Failed to request native notification permission:', error);
      return {
        status: 'denied',
        canRequest: false,
        message: 'Native notifications not available'
      };
    }
  }

  private async requestWebNotificationPermission(): Promise<PermissionResult> {
    if (!('Notification' in window)) {
      return {
        status: 'denied',
        canRequest: false,
        message: 'Notifications not supported in this browser'
      };
    }

    const currentPermission = Notification.permission;

    if (currentPermission === 'granted') {
      return {
        status: 'granted',
        canRequest: true,
        message: 'Web notifications already enabled'
      };
    }

    if (currentPermission === 'denied') {
      return {
        status: 'denied',
        canRequest: false,
        message: 'Notifications blocked. Please enable in browser settings.'
      };
    }

    try {
      const permission = await Notification.requestPermission();
      return {
        status: permission,
        canRequest: permission !== 'denied',
        message: permission === 'granted' 
          ? 'Web notifications enabled' 
          : 'Web notification permission denied'
      };
    } catch (error) {
      console.error('Error requesting web notification permission:', error);
      return {
        status: 'denied',
        canRequest: false,
        message: 'Failed to request notification permission'
      };
    }
  }

  async checkNotificationPermission(): Promise<PermissionResult> {
    const deviceInfo = await webToNativeDetection.getDeviceInfo();

    if (deviceInfo.isNative) {
      return this.checkNativeNotificationPermission();
    } else {
      return this.checkWebNotificationPermission();
    }
  }

  private async checkNativeNotificationPermission(): Promise<PermissionResult> {
    try {
      const dynamicImport = new Function('specifier', 'return import(specifier)');
      const { LocalNotifications } = await dynamicImport('@capacitor/local-notifications');

      const result = await LocalNotifications.checkPermissions();
      
      return {
        status: result.display === 'granted' ? 'granted' : 'denied',
        canRequest: result.display !== 'denied',
        message: `Native notification permission: ${result.display}`
      };
    } catch (error) {
      return {
        status: 'denied',
        canRequest: false,
        message: 'Native notifications not available'
      };
    }
  }

  private checkWebNotificationPermission(): Promise<PermissionResult> {
    if (!('Notification' in window)) {
      return Promise.resolve({
        status: 'denied',
        canRequest: false,
        message: 'Notifications not supported'
      });
    }

    const permission = Notification.permission;
    return Promise.resolve({
      status: permission,
      canRequest: permission !== 'denied',
      message: `Web notification permission: ${permission}`
    });
  }
}

export const nativePermissionService = new NativePermissionService();
export type { PermissionResult };
