import { Capacitor } from '@capacitor/core';
import { LocalNotifications, LocalNotificationSchema } from '@capacitor/local-notifications';
import { supabase } from '@/integrations/supabase/client';
import { timezoneNotificationHelper, JournalReminderTime } from './timezoneNotificationHelper';
import { notificationDebugLogger } from './notificationDebugLogger';

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
      notificationDebugLogger.logEvent('SCHEDULE_SKIP', { reason: 'not_native', platform: Capacitor.getPlatform() });
      return { success: true, scheduledCount: 0 };
    }

    try {
      // Initialize timezone helper
      await timezoneNotificationHelper.initializeUserTimezone();
      const userTimezone = timezoneNotificationHelper.getUserTimezone();
      
      notificationDebugLogger.logEvent('SCHEDULE_START', { 
        userTimezone, 
        deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        enabledCount: settings.reminders.filter(r => r.enabled).length 
      });

      // Clear existing scheduled notifications
      await this.clearScheduledNotifications();

      const enabledReminders = settings.reminders.filter(r => r.enabled);
      
      if (enabledReminders.length === 0) {
        console.log('[NativeNotificationService] No enabled reminders to schedule');
        notificationDebugLogger.logEvent('SCHEDULE_COMPLETE', { scheduledCount: 0, reason: 'no_enabled_reminders' });
        return { success: true, scheduledCount: 0 };
      }

      // Check permissions before scheduling
      const hasPermission = await this.checkAndRequestPermissions();
      if (!hasPermission) {
        const error = 'Notification permissions not granted';
        notificationDebugLogger.logEvent('SCHEDULE_FAILED', { error }, false, error);
        return { 
          success: false, 
          scheduledCount: 0, 
          error 
        };
      }

      const notifications: LocalNotificationSchema[] = [];
      const schedulingDebug: any[] = [];

      enabledReminders.forEach((reminder, index) => {
        try {
          // Convert time string to JournalReminderTime for timezone helper
          const timeKey = this.timeStringToReminderTime(reminder.time);
          
          // Get timezone-aware next occurrence in UTC
          const nextOccurrenceUTC = timezoneNotificationHelper.getNextReminderTimeInTimezone(timeKey);
          
          // Log timezone calculation details
          const debugInfo = {
            reminderTime: reminder.time,
            timeKey,
            userTimezone,
            nextOccurrenceUTC: nextOccurrenceUTC.toISOString(),
            nextOccurrenceLocal: timezoneNotificationHelper.formatTimeForUser(nextOccurrenceUTC),
            deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          };
          schedulingDebug.push(debugInfo);

          const notificationId = Date.now() + index;
          this.scheduledNotificationIds.push(notificationId);

          notifications.push({
            id: notificationId,
            title: '📝 Journal Reminder',
            body: reminder.label || `Time to write in your journal! ${reminder.time}`,
            schedule: {
              at: nextOccurrenceUTC, // Use UTC time from timezone helper
              repeats: true,
              every: 'day'
            },
            sound: 'default',
            actionTypeId: 'journal_reminder',
            extra: {
              reminderId: reminder.id,
              reminderTime: reminder.time,
              scheduledAt: nextOccurrenceUTC.toISOString(),
              userTimezone,
              debugInfo
            }
          });

          console.log(`[NativeNotificationService] Scheduled ${reminder.time} for ${nextOccurrenceUTC.toISOString()} (${timezoneNotificationHelper.formatTimeForUser(nextOccurrenceUTC)})`);
        } catch (error) {
          console.error(`[NativeNotificationService] Error processing reminder ${reminder.time}:`, error);
          notificationDebugLogger.logEvent('REMINDER_PROCESSING_ERROR', { 
            reminder, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          }, false);
        }
      });

      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
        console.log(`[NativeNotificationService] Scheduled ${notifications.length} timezone-aware daily reminders`);
        
        // Verify scheduling
        const pending = await LocalNotifications.getPending();
        console.log(`[NativeNotificationService] Pending notifications count: ${pending.notifications.length}`);
        
        // Log detailed scheduling information
        notificationDebugLogger.logEvent('SCHEDULE_SUCCESS', {
          scheduledCount: notifications.length,
          verifiedCount: pending.notifications.length,
          userTimezone,
          schedulingDetails: schedulingDebug,
          pendingNotifications: pending.notifications.map(n => ({
            id: n.id,
            schedule: n.schedule,
            extra: n.extra
          }))
        });

        // Verify timezone drift
        this.verifyTimezoneCalculations(schedulingDebug);
      }

      return { 
        success: true, 
        scheduledCount: notifications.length 
      };
    } catch (error) {
      console.error('[NativeNotificationService] Error scheduling reminders:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      notificationDebugLogger.logEvent('SCHEDULE_FAILED', { error: errorMessage }, false, errorMessage);
      return { 
        success: false, 
        scheduledCount: 0, 
        error: errorMessage 
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
          const error = 'Notification permissions not granted';
          notificationDebugLogger.logEvent('TEST_NOTIFICATION_FAILED', { error }, false, error);
          return { success: false, error };
        }

        // Schedule immediate test with timezone info
        await timezoneNotificationHelper.initializeUserTimezone();
        const userTimezone = timezoneNotificationHelper.getUserTimezone();
        const testTime = new Date(Date.now() + 3000); // 3 seconds from now
        
        await LocalNotifications.schedule({
          notifications: [{
            id: Date.now(),
            title: '🧪 Test Notification',
            body: `Your journal reminders are working perfectly! Timezone: ${userTimezone}`,
            schedule: { at: testTime },
            sound: 'default',
            actionTypeId: 'test_notification',
            extra: {
              isTest: true,
              userTimezone,
              scheduledAt: testTime.toISOString(),
              testType: 'immediate'
            }
          }]
        });
        
        console.log('[NativeNotificationService] Test notification scheduled for', testTime.toISOString());
        notificationDebugLogger.logEvent('TEST_NOTIFICATION_SCHEDULED', {
          scheduledAt: testTime.toISOString(),
          userTimezone,
          deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
        
        return { success: true };
      } else {
        // Web notification fallback
        if (Notification.permission === 'granted') {
          new Notification('🧪 Test Notification', {
            body: 'Your journal reminders are working perfectly!',
            icon: '/favicon.ico'
          });
          notificationDebugLogger.logEvent('WEB_TEST_NOTIFICATION', { platform: 'web' });
          return { success: true };
        } else {
          const error = 'Web notification permissions not granted';
          notificationDebugLogger.logEvent('WEB_TEST_FAILED', { error }, false, error);
          return { success: false, error };
        }
      }
    } catch (error) {
      console.error('[NativeNotificationService] Test notification failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      notificationDebugLogger.logEvent('TEST_NOTIFICATION_ERROR', { error: errorMessage }, false, errorMessage);
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  async getDetailedStatus() {
    await this.initialize();

    const permissionState = await this.checkPermissionStatus();
    const scheduledCount = await this.getScheduledNotificationsCount();
    
    // Initialize timezone helper for status
    await timezoneNotificationHelper.initializeUserTimezone();
    const userTimezone = timezoneNotificationHelper.getUserTimezone();
    const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    let pending = null;
    let androidEnhancedStatus = null;
    
    if (this.isNative) {
      try {
        pending = await LocalNotifications.getPending();
        
        // Enhanced Android status
        if (Capacitor.getPlatform() === 'android') {
          androidEnhancedStatus = await this.getAndroidEnhancedStatus();
        }
      } catch (error) {
        console.error('[NativeNotificationService] Error getting pending notifications:', error);
      }
    }

    const status = {
      isNative: this.isNative,
      permissionState,
      scheduledCount,
      platform: Capacitor.getPlatform(),
      isSupported: this.isNative || 'Notification' in window,
      pendingNotifications: pending?.notifications || [],
      userTimezone,
      deviceTimezone,
      timezoneMismatch: userTimezone !== deviceTimezone,
      timezoneDebug: timezoneNotificationHelper.getTimezoneDebugInfo(),
      androidEnhancedStatus,
      debugInfo: {
        scheduledIds: this.scheduledNotificationIds,
        lastCheck: new Date().toISOString(),
        debugEvents: notificationDebugLogger.getFilteredEvents({ 
          since: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }).length
      }
    };

    // Log status check
    notificationDebugLogger.logEvent('STATUS_CHECK', {
      permissionState,
      scheduledCount,
      userTimezone,
      deviceTimezone,
      timezoneMismatch: status.timezoneMismatch,
      platform: Capacitor.getPlatform()
    });

    return status;
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
  
  // Helper method to convert time string to JournalReminderTime
  private timeStringToReminderTime(timeString: string): JournalReminderTime {
    const [hours] = timeString.split(':').map(Number);
    
    if (hours >= 6 && hours < 12) return 'morning';
    if (hours >= 12 && hours < 17) return 'afternoon';
    if (hours >= 17 && hours < 22) return 'evening';
    return 'night';
  }

  // Verify timezone calculations for debugging
  private verifyTimezoneCalculations(schedulingDebug: any[]): void {
    schedulingDebug.forEach(debug => {
      const expectedUTC = new Date(debug.nextOccurrenceUTC);
      const currentUTC = new Date();
      
      // Check if the scheduled time is reasonable (within 24 hours)
      const timeDiff = expectedUTC.getTime() - currentUTC.getTime();
      const isReasonable = timeDiff > 0 && timeDiff <= 24 * 60 * 60 * 1000;
      
      notificationDebugLogger.logEvent('TIMEZONE_VERIFICATION', {
        reminderTime: debug.reminderTime,
        expectedUTC: debug.nextOccurrenceUTC,
        timeDiffMs: timeDiff,
        timeDiffHours: Math.round(timeDiff / (60 * 60 * 1000) * 100) / 100,
        isReasonable,
        userTimezone: debug.userTimezone,
        deviceTimezone: debug.deviceTimezone
      }, isReasonable, isReasonable ? undefined : 'Unreasonable scheduling time detected');
    });
  }

  // Get enhanced Android-specific status
  private async getAndroidEnhancedStatus(): Promise<any> {
    try {
      // Basic Android status - can be extended with more platform-specific checks
      const batteryOptimized = await this.checkBatteryOptimization();
      const exactAlarmPermission = await this.checkExactAlarmPermission();
      
      return {
        hasNotificationPermission: await this.checkAndRequestPermissions(),
        channelsCreated: true, // Capacitor handles this automatically
        scheduledCount: await this.getScheduledNotificationsCount(),
        batteryOptimized,
        exactAlarmPermission,
        lastError: null
      };
    } catch (error) {
      return {
        hasNotificationPermission: false,
        channelsCreated: false,
        scheduledCount: 0,
        batteryOptimized: null,
        exactAlarmPermission: null,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Check battery optimization status (Android-specific)
  private async checkBatteryOptimization(): Promise<boolean | null> {
    try {
      // This would require additional Capacitor plugins for full implementation
      // For now, return null to indicate unknown status
      return null;
    } catch {
      return null;
    }
  }

  // Check exact alarm permission (Android 12+)
  private async checkExactAlarmPermission(): Promise<boolean | null> {
    try {
      // This would require additional Capacitor plugins for full implementation
      // For now, return null to indicate unknown status
      return null;
    } catch {
      return null;
    }
  }
}

export const nativeNotificationService = NativeNotificationService.getInstance();
export default nativeNotificationService;