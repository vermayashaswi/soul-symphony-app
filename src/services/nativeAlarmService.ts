import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

interface PermissionStatus {
  hasNotificationPermission: boolean;
  hasExactAlarmPermission: boolean;
  androidVersion: number;
}

interface ScheduleResult {
  success: boolean;
  scheduledTime: string;
  requestCode: number;
}

interface NativeAlarmManagerPlugin {
  checkPermissions(): Promise<PermissionStatus>;
  requestPermissions(): Promise<{ granted: boolean }>;
  scheduleNotification(options: {
    id: string;
    title: string;
    body: string;
    time: string; // HH:mm format
  }): Promise<ScheduleResult>;
  cancelNotification(options: { id: string }): Promise<{ success: boolean }>;
  cancelAllNotifications(): Promise<{ success: boolean }>;
}

const NativeAlarmManager = registerPlugin<NativeAlarmManagerPlugin>('NativeAlarmManager');

interface NotificationReminder {
  id: string;
  enabled: boolean;
  time: string;
  label: string;
}

interface NotificationSettings {
  reminders: NotificationReminder[];
}

class NativeAlarmService {
  private static instance: NativeAlarmService;
  
  static getInstance(): NativeAlarmService {
    if (!NativeAlarmService.instance) {
      NativeAlarmService.instance = new NativeAlarmService();
    }
    return NativeAlarmService.instance;
  }
  
  async isNativeSupported(): Promise<boolean> {
    return Capacitor.isNativePlatform();
  }
  
  async checkPermissionStatus(): Promise<NotificationPermissionState> {
    if (!(await this.isNativeSupported())) {
      // Web fallback
      if (!('Notification' in window)) {
        return 'unsupported';
      }
      return Notification.permission as NotificationPermissionState;
    }
    
    try {
      const status = await NativeAlarmManager.checkPermissions();
      
      if (!status.hasNotificationPermission) {
        return 'denied';
      }
      
      if (!status.hasExactAlarmPermission && status.androidVersion >= 31) {
        return 'denied';
      }
      
      return 'granted';
    } catch (error) {
      console.error('Error checking permissions:', error);
      return 'unsupported';
    }
  }
  
  async requestPermissions(): Promise<{ granted: boolean; state: NotificationPermissionState }> {
    if (!(await this.isNativeSupported())) {
      // Web fallback
      if (!('Notification' in window)) {
        return { granted: false, state: 'unsupported' };
      }
      
      const permission = await Notification.requestPermission();
      return { 
        granted: permission === 'granted', 
        state: permission as NotificationPermissionState 
      };
    }
    
    try {
      const result = await NativeAlarmManager.requestPermissions();
      const newStatus = await this.checkPermissionStatus();
      
      return {
        granted: result.granted && newStatus === 'granted',
        state: newStatus
      };
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return { granted: false, state: 'denied' };
    }
  }
  
  async scheduleReminders(settings: NotificationSettings): Promise<void> {
    console.log('[NativeAlarmService] Scheduling reminders:', settings);
    
    // Clear existing notifications first
    await this.clearScheduledNotifications();
    
    if (!settings.reminders?.length) {
      console.log('[NativeAlarmService] No reminders to schedule');
      return;
    }
    
    const enabledReminders = settings.reminders.filter(r => r.enabled);
    console.log('[NativeAlarmService] Enabled reminders:', enabledReminders.length);
    
    if (!(await this.isNativeSupported())) {
      // Web fallback - just log
      console.log('[NativeAlarmService] Web platform - notifications not implemented');
      return;
    }
    
    // Check permissions
    const permissionState = await this.checkPermissionStatus();
    if (permissionState !== 'granted') {
      console.warn('[NativeAlarmService] Permissions not granted:', permissionState);
      return;
    }
    
    // Schedule each enabled reminder
    for (const reminder of enabledReminders) {
      try {
        const result = await NativeAlarmManager.scheduleNotification({
          id: reminder.id,
          title: 'Journal Reminder',
          body: `Time for your ${reminder.label.toLowerCase()} journal entry`,
          time: reminder.time
        });
        
        console.log(`[NativeAlarmService] Scheduled reminder ${reminder.id}:`, result);
      } catch (error) {
        console.error(`[NativeAlarmService] Failed to schedule reminder ${reminder.id}:`, error);
      }
    }
  }
  
  async clearScheduledNotifications(): Promise<void> {
    if (!(await this.isNativeSupported())) {
      console.log('[NativeAlarmService] Web platform - clear not needed');
      return;
    }
    
    try {
      await NativeAlarmManager.cancelAllNotifications();
      console.log('[NativeAlarmService] Cleared all scheduled notifications');
    } catch (error) {
      console.error('[NativeAlarmService] Failed to clear notifications:', error);
    }
  }
  
  async testNotification(): Promise<void> {
    if (!(await this.isNativeSupported())) {
      console.log('[NativeAlarmService] Web platform - test notification not supported');
      return;
    }
    
    try {
      // Schedule a test notification for 10 seconds from now
      const now = new Date();
      const testTime = new Date(now.getTime() + 10000);
      const timeString = `${testTime.getHours().toString().padStart(2, '0')}:${testTime.getMinutes().toString().padStart(2, '0')}`;
      
      const result = await NativeAlarmManager.scheduleNotification({
        id: 'test-notification',
        title: 'Test Notification',
        body: 'This is a test notification from Soulo',
        time: timeString
      });
      
      console.log('[NativeAlarmService] Test notification scheduled:', result);
    } catch (error) {
      console.error('[NativeAlarmService] Failed to schedule test notification:', error);
    }
  }
  
  async getDetailedStatus(): Promise<any> {
    try {
      const isNative = await this.isNativeSupported();
      const permissionState = await this.checkPermissionStatus();
      
      let nativeStatus = null;
      if (isNative) {
        try {
          nativeStatus = await NativeAlarmManager.checkPermissions();
        } catch (error) {
          console.error('Error getting native status:', error);
        }
      }
      
      return {
        isNative,
        permissionState,
        nativeStatus,
        platform: Capacitor.getPlatform(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[NativeAlarmService] Error getting detailed status:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

export const nativeAlarmService = NativeAlarmService.getInstance();