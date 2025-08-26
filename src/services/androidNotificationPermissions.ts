import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

interface AndroidPermissionStatus {
  hasNotificationPermission: boolean;
  hasExactAlarmPermission: boolean;
  isIgnoringBatteryOptimizations: boolean;
  androidVersion: number;
}

interface NotificationPermissionHandlerPlugin {
  checkAndRequestPermissions(): Promise<void>;
  getPermissionStatus(): Promise<AndroidPermissionStatus>;
  checkBatteryOptimization(): Promise<void>;
}

const NotificationPermissionHandler = registerPlugin<NotificationPermissionHandlerPlugin>('NotificationPermissionHandler');

class AndroidNotificationPermissions {
  private static instance: AndroidNotificationPermissions;
  
  static getInstance(): AndroidNotificationPermissions {
    if (!AndroidNotificationPermissions.instance) {
      AndroidNotificationPermissions.instance = new AndroidNotificationPermissions();
    }
    return AndroidNotificationPermissions.instance;
  }
  
  async isAndroidNative(): Promise<boolean> {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }
  
  async checkAndRequestAllPermissions(): Promise<boolean> {
    if (!(await this.isAndroidNative())) {
      return true; // Web/iOS - no Android-specific permissions needed
    }
    
    try {
      await NotificationPermissionHandler.checkAndRequestPermissions();
      return true;
    } catch (error) {
      console.error('Error requesting Android permissions:', error);
      return false;
    }
  }
  
  async getPermissionStatus(): Promise<AndroidPermissionStatus | null> {
    if (!(await this.isAndroidNative())) {
      return null;
    }
    
    try {
      const status = await NotificationPermissionHandler.getPermissionStatus();
      return status;
    } catch (error) {
      console.error('Error getting permission status:', error);
      return null;
    }
  }
  
  async requestBatteryOptimizationExemption(): Promise<void> {
    if (!(await this.isAndroidNative())) {
      return;
    }
    
    try {
      await NotificationPermissionHandler.checkBatteryOptimization();
    } catch (error) {
      console.error('Error requesting battery optimization exemption:', error);
    }
  }
}

export const androidNotificationPermissions = AndroidNotificationPermissions.getInstance();