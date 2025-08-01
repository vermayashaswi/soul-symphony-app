import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { nativeTimeService, NotificationScheduleTime } from './nativeTimeService';

export type JournalReminderTime = 'morning' | 'afternoon' | 'evening' | 'night';

export interface ScheduledNotification {
  id: number;
  timeSlot: JournalReminderTime;
  scheduleInfo: NotificationScheduleTime;
  nativeId: number;
  createdAt: Date;
  strategy: 'native' | 'web';
}

export interface NotificationStatus {
  isEnabled: boolean;
  activeNotifications: ScheduledNotification[];
  lastScheduleAttempt: Date | null;
  lastError: string | null;
  timeSyncStatus: 'synced' | 'failed' | 'unknown';
}

class EnhancedNotificationScheduler {
  private static instance: EnhancedNotificationScheduler;
  private scheduledNotifications: ScheduledNotification[] = [];
  private isInitialized = false;
  private status: NotificationStatus = {
    isEnabled: false,
    activeNotifications: [],
    lastScheduleAttempt: null,
    lastError: null,
    timeSyncStatus: 'unknown'
  };

  static getInstance(): EnhancedNotificationScheduler {
    if (!EnhancedNotificationScheduler.instance) {
      EnhancedNotificationScheduler.instance = new EnhancedNotificationScheduler();
    }
    return EnhancedNotificationScheduler.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[EnhancedNotificationScheduler] Initializing...');
      
      // Initialize time service first
      await nativeTimeService.initialize();
      
      // Initialize native notifications if available
      if (Capacitor.isNativePlatform()) {
        await this.initializeNativeNotifications();
      }
      
      this.isInitialized = true;
      this.status.timeSyncStatus = 'synced';
      
      console.log('[EnhancedNotificationScheduler] Initialized successfully');
    } catch (error) {
      console.error('[EnhancedNotificationScheduler] Initialization failed:', error);
      this.status.lastError = error instanceof Error ? error.message : 'Initialization failed';
      this.status.timeSyncStatus = 'failed';
      throw error;
    }
  }

  private async initializeNativeNotifications(): Promise<void> {
    try {
      // Request permissions
      const permissions = await LocalNotifications.requestPermissions();
      console.log('[EnhancedNotificationScheduler] Permissions:', permissions);

      if (permissions.display !== 'granted') {
        throw new Error('Notification permissions not granted');
      }

      // Clear any existing notifications
      await LocalNotifications.cancel({ notifications: [] });
      
    } catch (error) {
      console.error('[EnhancedNotificationScheduler] Native initialization failed:', error);
      throw error;
    }
  }

  async scheduleReminders(times: JournalReminderTime[]): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('Scheduler not initialized');
    }

    try {
      console.log('[EnhancedNotificationScheduler] Scheduling reminders for:', times);
      this.status.lastScheduleAttempt = new Date();

      // Clear existing notifications
      await this.clearAllNotifications();

      // Schedule new notifications
      const newNotifications: ScheduledNotification[] = [];

      for (const timeSlot of times) {
        const scheduleInfo = nativeTimeService.calculateNextNotificationTime(timeSlot);
        
        // Verify the calculated time
        if (!nativeTimeService.verifyScheduledTime(scheduleInfo)) {
          console.error('[EnhancedNotificationScheduler] Time verification failed for:', timeSlot);
          continue;
        }

        const notification = await this.scheduleNotification(timeSlot, scheduleInfo);
        if (notification) {
          newNotifications.push(notification);
        }
      }

      this.scheduledNotifications = newNotifications;
      this.status.activeNotifications = [...newNotifications];
      this.status.isEnabled = newNotifications.length > 0;
      this.status.lastError = null;

      console.log('[EnhancedNotificationScheduler] Scheduled notifications:', newNotifications.length);
      
      // Verify scheduled notifications
      await this.verifyNotifications();

      return newNotifications.length > 0;
    } catch (error) {
      console.error('[EnhancedNotificationScheduler] Scheduling failed:', error);
      this.status.lastError = error instanceof Error ? error.message : 'Scheduling failed';
      return false;
    }
  }

  private async scheduleNotification(
    timeSlot: JournalReminderTime, 
    scheduleInfo: NotificationScheduleTime
  ): Promise<ScheduledNotification | null> {
    try {
      const notificationId = Date.now() + Math.random() * 1000;
      const nativeId = Math.floor(notificationId);

      if (Capacitor.isNativePlatform()) {
        // Use UTC timestamp for native scheduling
        const scheduleOptions: ScheduleOptions = {
          notifications: [{
            id: nativeId,
            title: 'Time to Journal ✨',
            body: `Take a moment to reflect on your ${timeSlot}`,
            schedule: {
              at: new Date(scheduleInfo.utcTimestamp),
              allowWhileIdle: true,
              repeats: false
            },
            sound: 'default',
            actionTypeId: 'journal_reminder',
            extra: {
              timeSlot,
              verificationKey: scheduleInfo.verificationKey,
              scheduledAt: scheduleInfo.utcTimestamp
            }
          }]
        };

        console.log('[EnhancedNotificationScheduler] Scheduling native notification:', {
          timeSlot,
          nativeId,
          scheduledFor: scheduleInfo.scheduledFor,
          utcTimestamp: scheduleInfo.utcTimestamp,
          verificationKey: scheduleInfo.verificationKey
        });

        await LocalNotifications.schedule(scheduleOptions);

        return {
          id: notificationId,
          timeSlot,
          scheduleInfo,
          nativeId,
          createdAt: new Date(),
          strategy: 'native'
        };
      } else {
        // Web fallback (for testing)
        console.log('[EnhancedNotificationScheduler] Web scheduling not implemented yet');
        return null;
      }
    } catch (error) {
      console.error('[EnhancedNotificationScheduler] Failed to schedule notification:', error);
      return null;
    }
  }

  async clearAllNotifications(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        // Get all pending notifications and cancel them
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
          await LocalNotifications.cancel({ 
            notifications: pending.notifications.map(n => ({ id: n.id }))
          });
          console.log('[EnhancedNotificationScheduler] Cleared', pending.notifications.length, 'pending notifications');
        }
      }

      this.scheduledNotifications = [];
      this.status.activeNotifications = [];
      this.status.isEnabled = false;
      
    } catch (error) {
      console.error('[EnhancedNotificationScheduler] Failed to clear notifications:', error);
    }
  }

  async verifyNotifications(): Promise<void> {
    try {
      if (!Capacitor.isNativePlatform()) return;

      const pending = await LocalNotifications.getPending();
      const pendingIds = pending.notifications.map(n => n.id);
      
      console.log('[EnhancedNotificationScheduler] Verification - Pending IDs:', pendingIds);
      console.log('[EnhancedNotificationScheduler] Verification - Scheduled count:', this.scheduledNotifications.length);

      // Check if all our scheduled notifications are actually pending
      for (const scheduled of this.scheduledNotifications) {
        const isPending = pendingIds.includes(scheduled.nativeId);
        console.log('[EnhancedNotificationScheduler] Notification verification:', {
          timeSlot: scheduled.timeSlot,
          nativeId: scheduled.nativeId,
          isPending,
          scheduledFor: scheduled.scheduleInfo.scheduledFor
        });
      }
    } catch (error) {
      console.error('[EnhancedNotificationScheduler] Verification failed:', error);
    }
  }

  async testNotification(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[EnhancedNotificationScheduler] Test notification - Web platform, showing alert');
      alert('Test notification would appear here on mobile!');
      return;
    }

    try {
      // Schedule a test notification 5 seconds from now
      const testTime = Date.now() + 5000;
      const testId = 999999;

      await LocalNotifications.schedule({
        notifications: [{
          id: testId,
          title: 'Test Notification ✅',
          body: 'Your journal reminders are working!',
          schedule: {
            at: new Date(testTime),
            allowWhileIdle: true
          },
          sound: 'default'
        }]
      });

      console.log('[EnhancedNotificationScheduler] Test notification scheduled for 5 seconds');
    } catch (error) {
      console.error('[EnhancedNotificationScheduler] Test notification failed:', error);
      throw error;
    }
  }

  getStatus(): NotificationStatus {
    return {
      ...this.status,
      activeNotifications: [...this.scheduledNotifications]
    };
  }

  async refreshStatus(): Promise<NotificationStatus> {
    try {
      if (Capacitor.isNativePlatform()) {
        const pending = await LocalNotifications.getPending();
        console.log('[EnhancedNotificationScheduler] Refreshed status - Pending:', pending.notifications.length);
      }
      
      this.status.timeSyncStatus = 'synced';
    } catch (error) {
      console.error('[EnhancedNotificationScheduler] Status refresh failed:', error);
      this.status.timeSyncStatus = 'failed';
    }

    return this.getStatus();
  }
}

export const enhancedNotificationScheduler = EnhancedNotificationScheduler.getInstance();