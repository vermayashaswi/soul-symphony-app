import { Capacitor } from '@capacitor/core';
import { LocalNotifications, LocalNotificationSchema } from '@capacitor/local-notifications';
import { supabase } from '@/integrations/supabase/client';

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
  private scheduledNotificationIds: number[] = [];

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
      // Check current permissions
      const permissionStatus = await LocalNotifications.checkPermissions();
      console.log('[NativeNotificationService] Current permissions:', permissionStatus);

      if (permissionStatus.display !== 'granted') {
        console.log('[NativeNotificationService] Requesting permissions...');
        const requestResult = await LocalNotifications.requestPermissions();
        console.log('[NativeNotificationService] Permission request result:', requestResult);
        
        return requestResult.display === 'granted';
      }
      
      return true;
    } catch (error) {
      console.error('[NativeNotificationService] Error checking permissions:', error);
      return false;
    }
  }

  async checkPermissionStatus(): Promise<NotificationPermissionState> {
    await this.initialize();

    if (!this.isNative) {
      // Web notifications
      if (!('Notification' in window)) {
        return 'unsupported';
      }
      return Notification.permission as NotificationPermissionState;
    }

    try {
      const permissionStatus = await LocalNotifications.checkPermissions();
      return permissionStatus.display as NotificationPermissionState;
    } catch (error) {
      console.error('[NativeNotificationService] Error checking permission status:', error);
      return 'denied';
    }
  }

  async requestPermissions(): Promise<{ granted: boolean; state: NotificationPermissionState }> {
    await this.initialize();

    try {
      if (this.isNative) {
        const hasPermission = await this.checkAndRequestPermissions();
        const state = await this.checkPermissionStatus();
        return { granted: hasPermission, state };
      } else {
        // Web notifications
        if (!('Notification' in window)) {
          return { granted: false, state: 'unsupported' };
        }

        const permission = await Notification.requestPermission();
        return { 
          granted: permission === 'granted', 
          state: permission as NotificationPermissionState 
        };
      }
    } catch (error) {
      console.error('[NativeNotificationService] Permission request failed:', error);
      return { granted: false, state: 'denied' };
    }
  }

  async scheduleReminders(settings: NotificationSettings): Promise<{ success: boolean; scheduledCount: number; error?: string }> {
    await this.initialize();

    if (!this.isNative) {
      console.log('[NativeNotificationService] Not native platform, skipping local scheduling');
      return { success: true, scheduledCount: 0 };
    }

    try {
      // Clear existing scheduled notifications
      await this.clearScheduledNotifications();

      const enabledReminders = settings.reminders.filter(r => r.enabled);
      
      if (enabledReminders.length === 0) {
        console.log('[NativeNotificationService] No enabled reminders to schedule');
        return { success: true, scheduledCount: 0 };
      }

      // Check permissions before scheduling
      const hasPermission = await this.checkAndRequestPermissions();
      if (!hasPermission) {
        return { 
          success: false, 
          scheduledCount: 0, 
          error: 'Notification permissions not granted' 
        };
      }

      const notifications: LocalNotificationSchema[] = [];
      const now = new Date();

      enabledReminders.forEach((reminder, index) => {
        const [hours, minutes] = reminder.time.split(':').map(Number);
        
        // Calculate next occurrence
        const scheduleDate = new Date();
        scheduleDate.setHours(hours, minutes, 0, 0);
        
        // If time has passed today, schedule for tomorrow
        if (scheduleDate <= now) {
          scheduleDate.setDate(scheduleDate.getDate() + 1);
        }

        const notificationId = Date.now() + index;
        this.scheduledNotificationIds.push(notificationId);

        notifications.push({
          id: notificationId,
          title: '📝 Journal Reminder',
          body: reminder.label || `Time to write in your journal! ${reminder.time}`,
          schedule: {
            at: scheduleDate,
            repeats: true,
            every: 'day'
          },
          sound: 'default',
          actionTypeId: 'journal_reminder',
          extra: {
            reminderId: reminder.id,
            reminderTime: reminder.time
          }
        });
      });

      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
        console.log(`[NativeNotificationService] Scheduled ${notifications.length} daily reminders`);
        
        // Verify scheduling
        const pending = await LocalNotifications.getPending();
        console.log(`[NativeNotificationService] Pending notifications count: ${pending.notifications.length}`);
      }

      return { 
        success: true, 
        scheduledCount: notifications.length 
      };
    } catch (error) {
      console.error('[NativeNotificationService] Error scheduling reminders:', error);
      return { 
        success: false, 
        scheduledCount: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async clearScheduledNotifications(): Promise<void> {
    if (!this.isNative) return;

    try {
      // Cancel all pending notifications
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
        console.log(`[NativeNotificationService] Cancelled ${pending.notifications.length} pending notifications`);
      }

      this.scheduledNotificationIds = [];
    } catch (error) {
      console.error('[NativeNotificationService] Error clearing notifications:', error);
    }
  }

  async getScheduledNotificationsCount(): Promise<number> {
    if (!this.isNative) return 0;

    try {
      const pending = await LocalNotifications.getPending();
      return pending.notifications.length;
    } catch (error) {
      console.error('[NativeNotificationService] Error getting scheduled count:', error);
      return 0;
    }
  }

  async testNotification(): Promise<{ success: boolean; error?: string }> {
    await this.initialize();

    try {
      if (this.isNative) {
        const hasPermission = await this.checkAndRequestPermissions();
        if (!hasPermission) {
          return { success: false, error: 'Notification permissions not granted' };
        }

        await LocalNotifications.schedule({
          notifications: [{
            id: Date.now(),
            title: '🧪 Test Notification',
            body: 'Your journal reminders are working perfectly!',
            schedule: { at: new Date(Date.now() + 2000) }, // 2 seconds from now
            sound: 'default',
            actionTypeId: 'test_notification'
          }]
        });
        
        console.log('[NativeNotificationService] Test notification scheduled');
        return { success: true };
      } else {
        // Web notification fallback
        if (Notification.permission === 'granted') {
          new Notification('🧪 Test Notification', {
            body: 'Your journal reminders are working perfectly!',
            icon: '/favicon.ico'
          });
          return { success: true };
        } else {
          return { success: false, error: 'Web notification permissions not granted' };
        }
      }
    } catch (error) {
      console.error('[NativeNotificationService] Test notification failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async getDetailedStatus() {
    await this.initialize();

    const permissionState = await this.checkPermissionStatus();
    const scheduledCount = await this.getScheduledNotificationsCount();
    
    let pending = null;
    if (this.isNative) {
      try {
        pending = await LocalNotifications.getPending();
      } catch (error) {
        console.error('[NativeNotificationService] Error getting pending notifications:', error);
      }
    }

    return {
      isNative: this.isNative,
      permissionState,
      scheduledCount,
      platform: Capacitor.getPlatform(),
      isSupported: this.isNative || 'Notification' in window,
      pendingNotifications: pending?.notifications || [],
      debugInfo: {
        scheduledIds: this.scheduledNotificationIds,
        lastCheck: new Date().toISOString()
      }
    };
  }

  async saveAndScheduleSettings(settings: NotificationSettings): Promise<{ success: boolean; error?: string; scheduledCount?: number }> {
    try {
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
        return { success: false, error: saveError.message };
      }

      // Schedule notifications natively
      const scheduleResult = await this.scheduleReminders(settings);
      
      if (!scheduleResult.success) {
        return { 
          success: false, 
          error: `Settings saved but scheduling failed: ${scheduleResult.error}` 
        };
      }

      console.log('[NativeNotificationService] Settings saved and notifications scheduled');
      return { 
        success: true, 
        scheduledCount: scheduleResult.scheduledCount 
      };
    } catch (error) {
      console.error('[NativeNotificationService] Error saving and scheduling:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async getReminderSettings(): Promise<NotificationSettings | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('[NativeNotificationService] User not authenticated');
        return null;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('reminder_settings')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('[NativeNotificationService] Error fetching settings:', error);
        return null;
      }

      if (profile?.reminder_settings && typeof profile.reminder_settings === 'object') {
        const settings = profile.reminder_settings as any;
        
        if (settings.reminders && Array.isArray(settings.reminders)) {
          return settings as NotificationSettings;
        }
      }

      return null;
    } catch (error) {
      console.error('[NativeNotificationService] Error getting reminder settings:', error);
      return null;
    }
  }
}

export const nativeNotificationService = NativeNotificationService.getInstance();
export default nativeNotificationService;