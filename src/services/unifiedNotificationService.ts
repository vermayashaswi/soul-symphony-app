/**
 * Unified Notification Service
 * 
 * Consolidates all notification services into one coherent system
 * with proper timezone handling and WebView detection
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { addDays, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { notificationDebugLogger } from './notificationDebugLogger';
import { getNotificationTimezoneConfig, getNextNotificationTime } from '@/utils/notification-timezone-helper';

export type JournalReminderTime = 'morning' | 'afternoon' | 'evening' | 'night';

export interface NotificationEnvironment {
  isNative: boolean;
  isWebView: boolean;
  platform: string;
  supportsNativeNotifications: boolean;
  supportsWebNotifications: boolean;
  preferredStrategy: 'native' | 'web' | 'hybrid';
}

export interface ScheduledNotification {
  id: string;
  time: JournalReminderTime;
  scheduledFor: Date;
  strategy: 'native' | 'web';
  timeoutId?: number;
  verified: boolean;
}

export interface NotificationScheduleResult {
  success: boolean;
  scheduledNotifications: ScheduledNotification[];
  errors: string[];
  permissions: any;
  environment: NotificationEnvironment;
}

class UnifiedNotificationService {
  private static instance: UnifiedNotificationService;
  private scheduledNotifications: ScheduledNotification[] = [];
  private environment: NotificationEnvironment | null = null;
  private healthCheckInterval?: number;
  
  private readonly TIME_MAPPINGS: Record<JournalReminderTime, { hour: number; minute: number }> = {
    morning: { hour: 8, minute: 0 },
    afternoon: { hour: 14, minute: 0 },
    evening: { hour: 19, minute: 0 },
    night: { hour: 22, minute: 0 }
  };

  static getInstance(): UnifiedNotificationService {
    if (!UnifiedNotificationService.instance) {
      UnifiedNotificationService.instance = new UnifiedNotificationService();
    }
    return UnifiedNotificationService.instance;
  }

  constructor() {
    this.initializeEnvironment();
  }

  private async initializeEnvironment(): Promise<void> {
    const isCapacitorNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();
    
    // Detect if we're in Capacitor WebView vs true native vs web browser
    const isWebView = isCapacitorNative && typeof window !== 'undefined' && 
                     (window.location.protocol.startsWith('http') || 
                      window.location.protocol === 'capacitor:');
    
    const supportsWebNotifications = typeof window !== 'undefined' && 'Notification' in window;
    
    let supportsNativeNotifications = false;
    if (isCapacitorNative) {
      try {
        await LocalNotifications.checkPermissions();
        supportsNativeNotifications = true;
      } catch (error) {
        notificationDebugLogger.logEvent('error', 'UnifiedNotificationService', 'native_check_failed', { error: error.message });
      }
    }

    // Determine preferred strategy
    let preferredStrategy: 'native' | 'web' | 'hybrid' = 'web';
    
    if (supportsNativeNotifications && !isWebView) {
      preferredStrategy = 'native';
    } else if (isWebView && supportsWebNotifications) {
      // For WebView, use hybrid approach - try native first, fallback to web
      preferredStrategy = 'hybrid';
    } else if (supportsWebNotifications) {
      preferredStrategy = 'web';
    }

    this.environment = {
      isNative: isCapacitorNative,
      isWebView,
      platform,
      supportsNativeNotifications,
      supportsWebNotifications,
      preferredStrategy
    };

    notificationDebugLogger.logEvent('system_check', 'UnifiedNotificationService', 'environment_detected', {
      environment: this.environment
    });

    console.log('[UnifiedNotificationService] Environment detected:', this.environment);
  }

  /**
   * Request permissions and schedule notifications with comprehensive timezone handling
   */
  async scheduleJournalReminders(
    times: JournalReminderTime[], 
    userTimezone?: string
  ): Promise<NotificationScheduleResult> {
    if (!this.environment) {
      await this.initializeEnvironment();
    }

    const timezoneConfig = getNotificationTimezoneConfig(userTimezone);
    const errors: string[] = [];
    const scheduledNotifications: ScheduledNotification[] = [];

    notificationDebugLogger.logEvent('scheduling', 'UnifiedNotificationService', 'schedule_start', {
      times,
      userTimezone,
      timezoneConfig,
      environment: this.environment
    });

    try {
      // Clear existing notifications
      await this.clearAllNotifications();

      // Request permissions based on strategy
      const permissions = await this.requestPermissions();
      
      if (!permissions.granted) {
        errors.push('Notification permissions not granted');
        notificationDebugLogger.logSchedulingAttempt(
          times, userTimezone, false, {}, errors, permissions, this.environment
        );
        return {
          success: false,
          scheduledNotifications: [],
          errors,
          permissions,
          environment: this.environment!
        };
      }

      // Schedule notifications based on preferred strategy
      for (const time of times) {
        try {
          const scheduled = await this.scheduleIndividualNotification(time, timezoneConfig.userTimezone);
          if (scheduled) {
            scheduledNotifications.push(scheduled);
          }
        } catch (error) {
          const errorMsg = `Failed to schedule ${time}: ${error.message}`;
          errors.push(errorMsg);
          console.error('[UnifiedNotificationService]', errorMsg, error);
        }
      }

      // Verify scheduling worked
      await this.verifyScheduledNotifications();

      const success = scheduledNotifications.length > 0;
      const scheduledForLog = Object.fromEntries(
        scheduledNotifications.map(n => [n.time, n.scheduledFor.toISOString()])
      );

      notificationDebugLogger.logSchedulingAttempt(
        times, userTimezone, success, scheduledForLog, errors, permissions, this.environment
      );

      // Start health monitoring
      if (success) {
        this.startHealthCheck();
      }

      return {
        success,
        scheduledNotifications,
        errors,
        permissions,
        environment: this.environment!
      };

    } catch (error) {
      const errorMsg = `Critical scheduling error: ${error.message}`;
      errors.push(errorMsg);
      
      notificationDebugLogger.logEvent('error', 'UnifiedNotificationService', 'critical_error', {
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        scheduledNotifications: [],
        errors,
        permissions: { granted: false },
        environment: this.environment!
      };
    }
  }

  private async scheduleIndividualNotification(
    time: JournalReminderTime, 
    timezone: string
  ): Promise<ScheduledNotification | null> {
    const strategy = this.environment!.preferredStrategy;
    
    if (strategy === 'native' || (strategy === 'hybrid' && this.environment!.supportsNativeNotifications)) {
      return await this.scheduleNativeNotification(time, timezone);
    } else if (this.environment!.supportsWebNotifications) {
      return this.scheduleWebNotification(time, timezone);
    }
    
    throw new Error(`No supported notification method available for ${time}`);
  }

  private async scheduleNativeNotification(
    time: JournalReminderTime, 
    timezone: string
  ): Promise<ScheduledNotification> {
    const { hour, minute } = this.TIME_MAPPINGS[time];
    const nextTime = getNextNotificationTime({ hour, minute }, timezone);
    
    const notification = {
      id: this.getNotificationId(time),
      title: this.getNotificationTitle(time),
      body: this.getNotificationBody(time),
      schedule: {
        on: { hour, minute },
        every: 'day' as const,
        allowWhileIdle: true
      },
      sound: 'default',
      actionTypeId: 'JOURNAL_REMINDER',
      extra: {
        time,
        timezone,
        scheduledAt: new Date().toISOString()
      }
    };

    await LocalNotifications.schedule({ notifications: [notification] });

    const scheduled: ScheduledNotification = {
      id: `native-${time}`,
      time,
      scheduledFor: nextTime,
      strategy: 'native',
      verified: false
    };

    console.log(`[UnifiedNotificationService] Native notification scheduled for ${time}:`, {
      hour, minute, nextTime: nextTime.toLocaleString(), timezone
    });

    return scheduled;
  }

  private scheduleWebNotification(
    time: JournalReminderTime, 
    timezone: string
  ): ScheduledNotification {
    const { hour, minute } = this.TIME_MAPPINGS[time];
    const nextTime = getNextNotificationTime({ hour, minute }, timezone);
    const delay = nextTime.getTime() - Date.now();

    if (delay <= 0) {
      throw new Error(`Cannot schedule ${time} - time is in the past`);
    }

    const timeoutId = window.setTimeout(() => {
      this.showWebNotification(time);
      // Reschedule for next day
      this.scheduleWebNotification(time, timezone);
    }, delay);

    const scheduled: ScheduledNotification = {
      id: `web-${time}`,
      time,
      scheduledFor: nextTime,
      strategy: 'web',
      timeoutId,
      verified: true
    };

    console.log(`[UnifiedNotificationService] Web notification scheduled for ${time}:`, {
      delay: `${Math.round(delay / 1000 / 60)} minutes`,
      nextTime: nextTime.toLocaleString(),
      timezone
    });

    return scheduled;
  }

  private showWebNotification(time: JournalReminderTime): void {
    if (Notification.permission !== 'granted') return;

    const notification = new Notification(this.getNotificationTitle(time), {
      body: this.getNotificationBody(time),
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `journal-reminder-${time}`,
      requireInteraction: false,
      data: { time, action: 'open_journal' }
    });

    notificationDebugLogger.logEvent('notification_fired', 'UnifiedNotificationService', 'web_notification_shown', {
      time,
      timestamp: new Date().toISOString()
    });

    // Auto-close after 8 seconds
    setTimeout(() => notification.close(), 8000);

    // Handle click
    notification.onclick = () => {
      window.focus();
      notification.close();
      // Navigate to app
      if (window.location.pathname.startsWith('/app')) {
        window.location.href = '/app/voice-entry';
      } else {
        window.location.href = '/app';
      }
    };
  }

  private async requestPermissions(): Promise<{ granted: boolean; details?: any }> {
    const strategy = this.environment!.preferredStrategy;
    
    try {
      if (strategy === 'native' || strategy === 'hybrid') {
        const result = await LocalNotifications.requestPermissions();
        return { 
          granted: result.display === 'granted', 
          details: result 
        };
      } else {
        const result = await Notification.requestPermission();
        return { 
          granted: result === 'granted', 
          details: { permission: result } 
        };
      }
    } catch (error) {
      console.error('[UnifiedNotificationService] Permission request failed:', error);
      return { granted: false, details: { error: error.message } };
    }
  }

  private async verifyScheduledNotifications(): Promise<void> {
    if (this.environment!.supportsNativeNotifications) {
      try {
        const pending = await LocalNotifications.getPending();
        console.log(`[UnifiedNotificationService] Verification: ${pending.notifications.length} native notifications pending`);
        
        // Update verification status
        this.scheduledNotifications.forEach(scheduled => {
          if (scheduled.strategy === 'native') {
            scheduled.verified = pending.notifications.some(n => n.id === this.getNotificationId(scheduled.time));
          }
        });
      } catch (error) {
        console.warn('[UnifiedNotificationService] Could not verify native notifications:', error);
      }
    }
  }

  private async clearAllNotifications(): Promise<void> {
    // Clear web timeouts
    this.scheduledNotifications.forEach(scheduled => {
      if (scheduled.timeoutId) {
        clearTimeout(scheduled.timeoutId);
      }
    });

    // Clear native notifications
    if (this.environment!.supportsNativeNotifications) {
      try {
        await LocalNotifications.cancel({ notifications: [] });
        await LocalNotifications.removeAllDeliveredNotifications();
      } catch (error) {
        console.warn('[UnifiedNotificationService] Could not clear native notifications:', error);
      }
    }

    this.scheduledNotifications = [];
  }

  private getNotificationId(time: JournalReminderTime): number {
    const idMap = { morning: 1001, afternoon: 1002, evening: 1003, night: 1004 };
    return idMap[time];
  }

  private getNotificationTitle(time: JournalReminderTime): string {
    const titles = {
      morning: "🌅 Good Morning! Time for your journal",
      afternoon: "☀️ Afternoon reflection time",
      evening: "🌙 Evening journal reminder",
      night: "✨ End your day with journaling"
    };
    return titles[time];
  }

  private getNotificationBody(time: JournalReminderTime): string {
    const bodies = {
      morning: "Start your day by recording your thoughts and intentions",
      afternoon: "Take a moment to reflect on your day so far",
      evening: "Capture your evening thoughts and experiences",
      night: "Reflect on your day before you rest"
    };
    return bodies[time];
  }

  private startHealthCheck(): void {
    // Clear existing health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Check every 6 hours
    this.healthCheckInterval = window.setInterval(async () => {
      await this.performHealthCheck();
    }, 6 * 60 * 60 * 1000);
  }

  private async performHealthCheck(): Promise<void> {
    try {
      await this.verifyScheduledNotifications();
      
      const unverified = this.scheduledNotifications.filter(s => !s.verified);
      if (unverified.length > 0) {
        notificationDebugLogger.logEvent('error', 'UnifiedNotificationService', 'health_check_failed', {
          unverifiedCount: unverified.length,
          unverified: unverified.map(s => s.time)
        });
      }
    } catch (error) {
      notificationDebugLogger.logEvent('error', 'UnifiedNotificationService', 'health_check_error', {
        error: error.message
      });
    }
  }

  /**
   * Test notification functionality
   */
  async testNotification(): Promise<boolean> {
    try {
      if (this.environment!.supportsNativeNotifications) {
        await LocalNotifications.schedule({
          notifications: [{
            id: 9999,
            title: 'Test Journal Reminder 🧪',
            body: 'Your notifications are working perfectly!',
            schedule: { at: new Date(Date.now() + 2000) }
          }]
        });
        return true;
      } else if (this.environment!.supportsWebNotifications && Notification.permission === 'granted') {
        new Notification('Test Journal Reminder 🧪', {
          body: 'Your notifications are working perfectly!',
          icon: '/favicon.ico'
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('[UnifiedNotificationService] Test notification failed:', error);
      return false;
    }
  }

  /**
   * Get comprehensive status
   */
  async getStatus(): Promise<any> {
    if (!this.environment) {
      await this.initializeEnvironment();
    }

    const status: any = {
      environment: this.environment,
      scheduledNotifications: this.scheduledNotifications,
      debugData: notificationDebugLogger.getDebugData().summary,
      healthCheckActive: !!this.healthCheckInterval
    };

    if (this.environment!.supportsNativeNotifications) {
      try {
        const permissions = await LocalNotifications.checkPermissions();
        const pending = await LocalNotifications.getPending();
        status.nativeStatus = {
          permissions,
          pendingCount: pending.notifications.length,
          pendingIds: pending.notifications.map(n => n.id)
        };
      } catch (error) {
        status.nativeStatus = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    if (this.environment!.supportsWebNotifications) {
      status.webStatus = {
        permission: Notification.permission,
        supported: true
      };
    }

    return status;
  }

  /**
   * Disable all notifications
   */
  async disableNotifications(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    await this.clearAllNotifications();

    notificationDebugLogger.logEvent('user_action', 'UnifiedNotificationService', 'notifications_disabled', {
      timestamp: new Date().toISOString()
    });
  }
}

export const unifiedNotificationService = UnifiedNotificationService.getInstance();