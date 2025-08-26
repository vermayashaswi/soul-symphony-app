import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { nativeAlarmService } from './nativeAlarmService';
import { androidNotificationPermissions } from './androidNotificationPermissions';

export interface NotificationReminder {
  id: string;
  enabled: boolean;
  time: string; // HH:MM format
  label: string;
}

export interface NotificationSettings {
  reminders: NotificationReminder[];
}

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

class NativeNotificationService {
  private static instance: NativeNotificationService;
  private isNative = false;
  private isInitialized = false;

  static getInstance(): NativeNotificationService {
    if (!NativeNotificationService.instance) {
      NativeNotificationService.instance = new NativeNotificationService();
    }
    return NativeNotificationService.instance;
  }

  private async initialize() {
    if (this.isInitialized) return;
    
    this.isNative = Capacitor.isNativePlatform();
    this.isInitialized = true;
    
    console.log('[NativeNotificationService] Initialized. Native:', this.isNative);
    
    if (this.isNative) {
      // Request permissions on initialization
      await this.checkAndRequestPermissions();
    }
  }

  private async checkAndRequestPermissions(): Promise<boolean> {
    try {
      const result = await this.requestPermissions();
      return result.granted;
    } catch (error) {
      console.error('[NativeNotificationService] Error checking permissions:', error);
      return false;
    }
  }

  async checkPermissionStatus(): Promise<NotificationPermissionState> {
    console.log('[NativeNotificationService] Checking permission status via native alarm service');
    return await nativeAlarmService.checkPermissionStatus();
  }

  async requestPermissions(): Promise<{ granted: boolean; state: NotificationPermissionState }> {
    console.log('[NativeNotificationService] Starting permission request via native alarm service');
    return await nativeAlarmService.requestPermissions();
  }

  async scheduleReminders(settings: NotificationSettings): Promise<{ success: boolean; scheduledCount: number; error?: string }> {
    console.log('[NativeNotificationService] Delegating to native alarm service');
    try {
      await nativeAlarmService.scheduleReminders(settings);
      const scheduledCount = settings.reminders.filter(r => r.enabled).length;
      return { success: true, scheduledCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, scheduledCount: 0, error: errorMessage };
    }
  }

  async clearScheduledNotifications(): Promise<void> {
    console.log('[NativeNotificationService] Delegating clear to native alarm service');
    await nativeAlarmService.clearScheduledNotifications();
  }

  async getScheduledNotificationsCount(): Promise<number> {
    // Native alarm service doesn't expose count - return 0 for now
    return 0;
  }

  async testNotification(): Promise<{ success: boolean; error?: string }> {
    console.log('[NativeNotificationService] Delegating test to native alarm service');
    try {
      await nativeAlarmService.testNotification();
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  async getDetailedStatus(): Promise<any> {
    console.log('[NativeNotificationService] Getting detailed status via native alarm service');
    return await nativeAlarmService.getDetailedStatus();
  }

  async saveAndScheduleSettings(settings: NotificationSettings): Promise<{ success: boolean; error?: string; scheduledCount?: number }> {
    try {
      console.log('[NativeNotificationService] Saving and scheduling settings');
      
      // Save to database
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const { error: saveError } = await supabase
        .from('profiles')
        .update({ reminder_settings: settings as any })
        .eq('id', user.id);

      if (saveError) {
        console.error('[NativeNotificationService] Error saving settings:', saveError);
        return { success: false, error: 'Failed to save settings' };
      }

      // Schedule reminders
      await this.scheduleReminders(settings);
      
      const scheduledCount = settings.reminders.filter(r => r.enabled).length;
      
      console.log('[NativeNotificationService] Settings saved and scheduled successfully');
      return { 
        success: true, 
        scheduledCount 
      };
    } catch (error) {
      console.error('[NativeNotificationService] Error in saveAndScheduleSettings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  async getReminderSettings(): Promise<NotificationSettings | null> {
    try {
      console.log('[NativeNotificationService] Getting reminder settings from database');
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('[NativeNotificationService] No authenticated user');
        return null;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('reminder_settings')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('[NativeNotificationService] Error fetching settings:', error);
        return null;
      }

      const settings = data?.reminder_settings as unknown as NotificationSettings;
      console.log('[NativeNotificationService] Retrieved settings:', settings);
      
      return settings || { reminders: [] };
    } catch (error) {
      console.error('[NativeNotificationService] Error in getReminderSettings:', error);
      return null;
    }
  }
}

export const nativeNotificationService = NativeNotificationService.getInstance();