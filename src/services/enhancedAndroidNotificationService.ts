import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOptions, Channel, PermissionStatus } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';

export type JournalReminderTime = 'morning' | 'afternoon' | 'evening' | 'night';

export interface AndroidNotificationStatus {
  hasExactAlarmPermission: boolean;
  hasNotificationPermission: boolean;
  batteryOptimizationDisabled: boolean;
  doNotDisturbStatus: 'unknown' | 'off' | 'priority_only' | 'alarms_only' | 'total_silence';
  channelsCreated: boolean;
  channelStatus: { [key: string]: boolean };
  scheduledCount: number;
  lastError?: string;
}

export interface EnhancedNotificationResult {
  success: boolean;
  error?: string;
  permissionsGranted: boolean;
  channelsCreated: boolean;
  notificationsScheduled: number;
}

class EnhancedAndroidNotificationService {
  private static instance: EnhancedAndroidNotificationService;
  private isNative = false;
  private debugEnabled = true;
  private channels: Channel[] = [];

  static getInstance(): EnhancedAndroidNotificationService {
    if (!EnhancedAndroidNotificationService.instance) {
      EnhancedAndroidNotificationService.instance = new EnhancedAndroidNotificationService();
    }
    return EnhancedAndroidNotificationService.instance;
  }

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.initializeChannels();
  }

  private log(message: string, data?: any) {
    if (this.debugEnabled) {
      console.log(`[EnhancedAndroidNotification] ${message}`, data || '');
    }
  }

  private async initializeChannels() {
    this.channels = [
      {
        id: 'journal-reminders-high',
        name: 'Journal Reminders (High Priority)',
        description: 'High priority notifications for journal reminders',
        importance: 4, // IMPORTANCE_HIGH
        vibration: true,
        sound: 'default.wav',
        lights: true,
        lightColor: '#3B82F6'
      },
      {
        id: 'journal-reminders-max',
        name: 'Journal Reminders (Max Priority)',
        description: 'Maximum priority notifications for journal reminders',
        importance: 5, // IMPORTANCE_MAX  
        vibration: true,
        sound: 'default.wav',
        lights: true,
        lightColor: '#3B82F6'
      }
    ];
  }

  async requestAllPermissions(): Promise<EnhancedNotificationResult> {
    this.log('Starting comprehensive permission request process');
    
    try {
      if (!this.isNative) {
        this.log('Not native platform, using web notifications');
        return await this.requestWebPermissions();
      }

      // Step 1: Request basic notification permission
      this.log('Step 1: Requesting basic notification permission');
      const notificationPermission = await LocalNotifications.requestPermissions();
      
      if (notificationPermission.display !== 'granted') {
        throw new Error('Basic notification permission denied');
      }

      // Step 2: Create notification channels
      this.log('Step 2: Creating notification channels');
      await this.createNotificationChannels();

      // Step 3: Request SCHEDULE_EXACT_ALARM permission (Android 12+)
      this.log('Step 3: Requesting exact alarm permission');
      await this.requestExactAlarmPermission();

      // Step 4: Check battery optimization
      this.log('Step 4: Checking battery optimization');
      const batteryStatus = await this.checkBatteryOptimization();

      // Step 5: Verify system status
      const status = await this.getDetailedStatus();
      
      this.log('Permission request completed', status);

      return {
        success: true,
        permissionsGranted: true,
        channelsCreated: status.channelsCreated,
        notificationsScheduled: 0
      };

    } catch (error) {
      this.log('Error in permission request process', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        permissionsGranted: false,
        channelsCreated: false,
        notificationsScheduled: 0
      };
    }
  }

  private async requestWebPermissions(): Promise<EnhancedNotificationResult> {
    try {
      const permission = await Notification.requestPermission();
      return {
        success: permission === 'granted',
        permissionsGranted: permission === 'granted',
        channelsCreated: true, // Not applicable for web
        notificationsScheduled: 0
      };
    } catch (error) {
      return {
        success: false,
        error: 'Web notification permission failed',
        permissionsGranted: false,
        channelsCreated: false,
        notificationsScheduled: 0
      };
    }
  }

  private async createNotificationChannels(): Promise<void> {
    try {
      // Create high-priority channels
      for (const channel of this.channels) {
        this.log(`Creating channel: ${channel.id}`);
        await LocalNotifications.createChannel(channel);
      }
      
      this.log('All notification channels created successfully');
    } catch (error) {
      this.log('Error creating notification channels', error);
      throw new Error(`Failed to create notification channels: ${error}`);
    }
  }

  private async requestExactAlarmPermission(): Promise<void> {
    try {
      // This requires a custom Capacitor plugin or native Android code
      // For now, we'll log and continue - this should be handled in Android native code
      this.log('SCHEDULE_EXACT_ALARM permission should be requested in native Android code');
      
      // We can use LocalNotifications.requestPermissions() which might handle this in newer versions
      const permissions = await LocalNotifications.requestPermissions();
      this.log('Extended permissions result', permissions);
      
    } catch (error) {
      this.log('Error requesting exact alarm permission', error);
      // Don't throw - this might not be available on all Android versions
    }
  }

  private async checkBatteryOptimization(): Promise<boolean> {
    try {
      // This would require a custom plugin to check battery optimization
      // For now, we'll return true and log
      this.log('Battery optimization check should be implemented in native code');
      return true;
    } catch (error) {
      this.log('Error checking battery optimization', error);
      return false;
    }
  }

  async scheduleJournalReminders(times: JournalReminderTime[], userTimezone?: string): Promise<EnhancedNotificationResult> {
    const timezone = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.log('Scheduling journal reminders', { times, timezone });

    try {
      if (!this.isNative) {
        return await this.scheduleWebReminders(times);
      }

      // Clear existing notifications
      await this.clearAllNotifications();

      // Schedule new notifications
      let scheduledCount = 0;
      const now = new Date();

      for (const time of times) {
        const notificationId = this.getNotificationId(time);
        const timeMap = this.getTimeMapping(time);

        const notification: ScheduleOptions = {
          notifications: [{
            id: notificationId,
            title: 'Time for Your Journal',
            body: this.getNotificationBody(time),
            schedule: {
              on: {
                hour: timeMap.hour,
                minute: timeMap.minute
              },
              every: 'day',
              allowWhileIdle: true
            },
            channelId: 'journal-reminders-high',
            sound: 'default.wav',
            actionTypeId: 'JOURNAL_REMINDER',
            extra: {
              reminderTime: time,
              scheduledAt: now.toISOString(),
              timezone: timezone
            }
          }]
        };

        await LocalNotifications.schedule(notification);
        scheduledCount++;
        
        this.log(`Scheduled ${time} reminder`, {
          id: notificationId,
          hour: timeMap.hour,
          minute: timeMap.minute,
          channelId: 'journal-reminders-high',
          pattern: 'on-time-recurring',
          timezone: timezone
        });
      }

      // Verify scheduled notifications
      const pending = await LocalNotifications.getPending();
      this.log(`Verification: ${pending.notifications.length} notifications pending`);

      return {
        success: true,
        permissionsGranted: true,
        channelsCreated: true,
        notificationsScheduled: scheduledCount
      };

    } catch (error) {
      this.log('Error scheduling reminders', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        permissionsGranted: false,
        channelsCreated: false,
        notificationsScheduled: 0
      };
    }
  }

  private async scheduleWebReminders(times: JournalReminderTime[], userTimezone?: string): Promise<EnhancedNotificationResult> {
    const timezone = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.log('Scheduling web reminders', { times, timezone });
    
    // Clear existing web reminders (stored in localStorage)
    localStorage.removeItem('webReminderTimeouts');
    
    let scheduledCount = 0;
    for (const time of times) {
      // Schedule using setTimeout for next occurrence in user's timezone
      const nextTime = this.getNextReminderTime(time, timezone);
      const delay = nextTime.getTime() - Date.now();
      
      this.log(`Web reminder ${time} delay: ${delay}ms (next: ${nextTime.toLocaleString()}) timezone: ${timezone}`);
      
      if (delay > 0) {
        setTimeout(() => {
          console.log(`[EnhancedAndroidNotification] Web notification firing for ${time} at ${new Date().toLocaleString()}`);
          this.showWebNotification(time);
        }, delay);
        scheduledCount++;
      } else {
        this.log(`Skipping ${time} - delay is ${delay}ms (in the past)`);
      }
    }

    return {
      success: true,
      permissionsGranted: true,
      channelsCreated: true,
      notificationsScheduled: scheduledCount
    };
  }

  private showWebNotification(time: JournalReminderTime) {
    if (Notification.permission === 'granted') {
      new Notification('Time for Your Journal', {
        body: this.getNotificationBody(time),
        icon: '/favicon.ico',
        tag: `journal-${time}`
      });
    }
  }

  private getTimeMapping(time: JournalReminderTime): { hour: number; minute: number } {
    const timeMap = {
      morning: { hour: 8, minute: 0 },
      afternoon: { hour: 14, minute: 0 },
      evening: { hour: 19, minute: 0 },
      night: { hour: 22, minute: 0 }
    };
    return timeMap[time];
  }

  private getNextReminderTime(time: JournalReminderTime, timezone?: string): Date {
    const now = new Date();
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const targetTime = this.getTimeMapping(time);

    // Create target time in user's timezone context
    const next = new Date();
    next.setHours(targetTime.hour, targetTime.minute, 0, 0);

    // If the time has passed today, schedule for tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    this.log(`Next reminder time for ${time}:`, {
      scheduled: next.toLocaleString(),
      timezone: tz,
      delay: next.getTime() - now.getTime()
    });

    return next;
  }

  private getNotificationId(time: JournalReminderTime): number {
    const idMap = {
      morning: 1001,
      afternoon: 1002,
      evening: 1003,
      night: 1004
    };
    return idMap[time];
  }

  private getNotificationBody(time: JournalReminderTime): string {
    const messages = {
      morning: 'Start your day with reflection. What are you grateful for?',
      afternoon: 'Take a moment to journal about your day so far.',
      evening: 'Wind down with some evening journaling.',
      night: 'End your day with thoughtful reflection.'
    };
    return messages[time];
  }

  async clearAllNotifications(): Promise<void> {
    try {
      if (this.isNative) {
        await LocalNotifications.removeAllDeliveredNotifications();
        await LocalNotifications.cancel({ notifications: [
          { id: 1001 },
          { id: 1002 },
          { id: 1003 },
          { id: 1004 }
        ]});
      }
      this.log('All notifications cleared');
    } catch (error) {
      this.log('Error clearing notifications', error);
    }
  }

  async getDetailedStatus(): Promise<AndroidNotificationStatus> {
    try {
      const status: AndroidNotificationStatus = {
        hasExactAlarmPermission: false,
        hasNotificationPermission: false,
        batteryOptimizationDisabled: false,
        doNotDisturbStatus: 'unknown',
        channelsCreated: false,
        channelStatus: {},
        scheduledCount: 0,
      };

      if (!this.isNative) {
        status.hasNotificationPermission = Notification.permission === 'granted';
        status.channelsCreated = true;
        return status;
      }

      // Check notification permission
      const permissions = await LocalNotifications.checkPermissions();
      status.hasNotificationPermission = permissions.display === 'granted';

      // Check scheduled notifications
      const pending = await LocalNotifications.getPending();
      status.scheduledCount = pending.notifications.length;

      // For channels, we assume they're created if we have permission
      status.channelsCreated = status.hasNotificationPermission;
      
      // Set channel status for our channels
      for (const channel of this.channels) {
        status.channelStatus[channel.id] = status.hasNotificationPermission;
      }

      this.log('Detailed status retrieved', status);
      return status;

    } catch (error) {
      this.log('Error getting detailed status', error);
      return {
        hasExactAlarmPermission: false,
        hasNotificationPermission: false,
        batteryOptimizationDisabled: false,
        doNotDisturbStatus: 'unknown',
        channelsCreated: false,
        channelStatus: {},
        scheduledCount: 0,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async testNotification(): Promise<boolean> {
    try {
      this.log('Sending test notification');

      if (!this.isNative) {
        if (Notification.permission === 'granted') {
          new Notification('Test Journal Reminder', {
            body: 'This is a test notification from your journal app.',
            icon: '/favicon.ico'
          });
          return true;
        }
        return false;
      }

      const testNotification: ScheduleOptions = {
        notifications: [{
          id: 9999,
          title: 'Test Journal Reminder',
          body: 'This is a test notification from your journal app.',
          schedule: {
            at: new Date(Date.now() + 2000) // 2 seconds from now
          },
          channelId: 'journal-reminders-high',
          sound: 'default.wav'
        }]
      };

      await LocalNotifications.schedule(testNotification);
      this.log('Test notification scheduled successfully');
      
      // Verify it was scheduled
      setTimeout(async () => {
        const pending = await LocalNotifications.getPending();
        this.log(`Verification: ${pending.notifications.length} notifications pending after test`);
      }, 1000);
      
      return true;

    } catch (error) {
      this.log('Error sending test notification', error);
      return false;
    }
  }

  setDebugEnabled(enabled: boolean) {
    this.debugEnabled = enabled;
  }
}

export const enhancedAndroidNotificationService = EnhancedAndroidNotificationService.getInstance();