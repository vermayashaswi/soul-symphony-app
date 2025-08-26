import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { unifiedNotificationService as enhancedNotificationService } from './unifiedNotificationService';
import { enhancedAndroidNotificationService, type AndroidNotificationStatus } from './enhancedAndroidNotificationService';

export type JournalReminderTime = 'morning' | 'afternoon' | 'evening' | 'night';

interface JournalReminderSettings {
  enabled: boolean;
  times: JournalReminderTime[];
  lastUpdated?: string;
}

interface ScheduledReminder {
  id: string;
  time: JournalReminderTime;
  scheduledFor: Date;
  timeoutId?: number;
  strategy: 'native' | 'serviceWorker' | 'web';
}

class JournalReminderService {
  private static instance: JournalReminderService;
  private scheduledReminders: ScheduledReminder[] = [];
  private healthCheckInterval?: number;
  private readonly HEALTH_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
  private isInitialized = false;
  private isNative = false;
  private strategy: 'native' | 'serviceWorker' | 'web' = 'web';
  
  // Time mappings for reminders
  private readonly TIME_MAPPINGS: Record<JournalReminderTime, { hour: number; minute: number }> = {
    morning: { hour: 8, minute: 0 },
    afternoon: { hour: 14, minute: 0 },
    evening: { hour: 19, minute: 0 },
    night: { hour: 22, minute: 0 }
  };

  static getInstance(): JournalReminderService {
    if (!JournalReminderService.instance) {
      JournalReminderService.instance = new JournalReminderService();
    }
    return JournalReminderService.instance;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      this.isNative = Capacitor.isNativePlatform();
      this.strategy = this.isNative ? 'native' : 'web';
      this.isInitialized = true;
      console.log('[JournalReminderService] Initialized with strategy:', this.strategy);
    }
  }

  private log(message: string, data?: any): void {
    console.log(`[JournalReminderService] ${message}`, data);
  }

  private error(message: string, error?: any): void {
    console.error(`[JournalReminderService] ${message}`, error);
  }

  async requestPermissionsAndSetup(times: JournalReminderTime[]): Promise<boolean> {
    console.log('[JournalReminderService] Setting up reminders for times using enhanced Android service:', times);
    
    this.ensureInitialized();
    
    try {
      // Clear any existing reminders first
      await this.clearAllReminders();
      
      // Use enhanced Android notification service for better Android compatibility
      if (this.isNative && Capacitor.getPlatform() === 'android') {
        console.log('[JournalReminderService] Using enhanced Android notification service');
        
        // Request all Android-specific permissions
        const permissionResult = await enhancedAndroidNotificationService.requestAllPermissions();
        
        if (!permissionResult.success) {
          console.error('[JournalReminderService] Enhanced Android permissions failed:', permissionResult.error);
          return false;
        }
        
        // Schedule reminders using enhanced service
        const scheduleResult = await enhancedAndroidNotificationService.scheduleJournalReminders(times);
        
        if (scheduleResult.success) {
          console.log('[JournalReminderService] Enhanced Android reminders scheduled:', scheduleResult);
          this.saveSettings({
            enabled: true,
            times: times,
            lastUpdated: new Date().toISOString()
          });
          this.startHealthCheck();
          return true;
        } else {
          console.error('[JournalReminderService] Enhanced Android scheduling failed:', scheduleResult.error);
          return false;
        }
      } else {
        // Fallback to original implementation for iOS/web
        const success = await this.setupReminders(times);
        
        if (success) {
          this.saveSettings({
            enabled: true,
            times: times,
            lastUpdated: new Date().toISOString()
          });
          console.log('[JournalReminderService] Reminders setup successful');
          this.startHealthCheck();
          return true;
        } else {
          console.log('[JournalReminderService] Failed to setup reminders');
          return false;
        }
      }
    } catch (error) {
      console.error('[JournalReminderService] Error setting up reminders:', error);
      return false;
    }
  }

  async disableReminders(): Promise<void> {
    this.log('Disabling journal reminders');
    
    // Clear all active reminders
    await this.clearAllReminders();
    
    // Stop health check
    this.stopHealthCheck();
    
    // Save disabled state
    this.saveSettings({ enabled: false, times: [] });
  }

  private async setupReminders(times: JournalReminderTime[]): Promise<boolean> {
    this.log('Setting up reminders for times:', times);
    
    try {
      // Clear existing reminders first
      await this.clearAllReminders();
      
      if (this.isNative) {
        // Use native notifications for mobile
        await this.setupNativeReminders(times);
      } else {
        // Use web notifications for web
        this.setupWebReminders(times);
      }
      
      // Start health check to monitor reminder status
      this.startHealthCheck();
      return true;
    } catch (error) {
      this.error('Error setting up reminders:', error);
      return false;
    }
  }

  private async setupNativeReminders(times: JournalReminderTime[]): Promise<void> {
    try {
      this.log('Setting up native reminders with recurring schedule');
      
      // Request permissions first
      const permissions = await LocalNotifications.requestPermissions();
      if (permissions.display !== 'granted') {
        throw new Error('Notification permissions not granted');
      }

      // Cancel existing notifications
      await LocalNotifications.cancel({ notifications: [] });

      // Schedule new recurring notifications
      const notifications = times.map((time, index) => {
        const { hour, minute } = this.TIME_MAPPINGS[time];
        
        return {
          id: index + 1,
          title: this.getNotificationTitle(time),
          body: this.getNotificationBody(time),
          schedule: {
            on: {
              hour,
              minute
            },
            every: 'day' as const,
            allowWhileIdle: true
          },
          sound: 'default',
          actionTypeId: 'JOURNAL_REMINDER',
          extra: {
            time,
            action: 'open_journal',
            recurring: true
          }
        };
      });

      await LocalNotifications.schedule({ notifications });
      
      // Track reminders
      times.forEach(time => {
        this.scheduledReminders.push({
          id: `native-${time}`,
          time,
          scheduledFor: this.getNextReminderTime(time),
          strategy: 'native'
        });
      });
      
      this.log(`Scheduled ${notifications.length} recurring native reminders`);
      
      // Verify scheduling worked
      setTimeout(async () => {
        const pending = await LocalNotifications.getPending();
        this.log(`Verification: ${pending.notifications.length} notifications pending after native scheduling`);
      }, 1000);
      
    } catch (error) {
      this.error('Error setting up native reminders:', error);
      throw error;
    }
  }

  private setupWebReminders(times: JournalReminderTime[]): void {
    this.log('Setting up web reminders');
    
    times.forEach(time => {
      const reminder = this.scheduleWebReminder(time);
      this.scheduledReminders.push(reminder);
    });
    
    this.log(`Scheduled ${this.scheduledReminders.length} web reminders`);
  }

  private scheduleWebReminder(time: JournalReminderTime): ScheduledReminder {
    const id = `web-${time}-${Date.now()}`;
    const scheduledFor = this.getNextReminderTime(time);
    
    this.log(`Scheduling web reminder for ${time} at ${scheduledFor.toLocaleString()}`);
    
    const timeoutMs = scheduledFor.getTime() - Date.now();
    
    const timeoutId = window.setTimeout(() => {
      this.log(`Showing web reminder for ${time}`);
      
      this.showWebNotification(time);
      
      // Schedule next occurrence
      const nextReminder = this.scheduleWebReminder(time);
      const index = this.scheduledReminders.findIndex(r => r.id === id);
      if (index !== -1) {
        this.scheduledReminders[index] = nextReminder;
      }
    }, timeoutMs);
    
    return { 
      id, 
      time, 
      scheduledFor, 
      timeoutId,
      strategy: 'web'
    };
  }

  private showWebNotification(time: JournalReminderTime): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      this.log('Cannot show web notification - permission not granted');
      return;
    }

    const notification = new Notification(this.getNotificationTitle(time), {
      body: this.getNotificationBody(time),
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `journal-reminder-${time}`,
      requireInteraction: false,
      silent: false,
      data: { time, action: 'open_journal' }
    });

    // Auto-close after 8 seconds
    setTimeout(() => {
      notification.close();
    }, 8000);

    // Handle notification click
    notification.onclick = () => {
      window.focus();
      notification.close();
      
      // Navigate to voice entry
      window.location.href = '/app/voice-entry';
    };
  }

  private getNotificationTitle(time: JournalReminderTime): string {
    const titles = {
      morning: "🌅 Good Morning! Time for your journal",
      afternoon: "☀️ Afternoon reflection time",
      evening: "🌙 Evening journal reminder",
      night: "✨ End your day with journaling"
    };
    
    return titles[time] || "📝 Time to journal";
  }

  private getNotificationBody(time: JournalReminderTime): string {
    const bodies = {
      morning: "Start your day by recording your thoughts and intentions",
      afternoon: "Take a moment to reflect on your day so far",
      evening: "Capture your evening thoughts and experiences", 
      night: "Reflect on your day before you rest"
    };
    
    return bodies[time] || "Tap to open Soulo and start voice journaling";
  }

  private getNextReminderTime(time: JournalReminderTime): Date {
    const now = new Date();
    const { hour, minute } = this.TIME_MAPPINGS[time];
    
    // Start with today's target time
    const today = new Date();
    today.setHours(hour, minute, 0, 0);
    
    // If today's time has already passed, schedule for tomorrow
    if (today.getTime() <= now.getTime()) {
      today.setDate(today.getDate() + 1);
    }
    
    this.log(`Reminder ${time} scheduled for ${today.toLocaleString()}`);
    return today;
  }

  private async clearAllReminders(): Promise<void> {
    this.log('Clearing all active reminders');
    
    // Clear web timeouts
    this.scheduledReminders.forEach(reminder => {
      if (reminder.timeoutId) {
        clearTimeout(reminder.timeoutId);
      }
    });
    
    // Clear native reminders if running natively
    if (this.isNative) {
      try {
        await LocalNotifications.cancel({ notifications: [] });
        this.log('Cancelled all native reminders');
      } catch (error) {
        this.error('Error cancelling native reminders:', error);
      }
    }
    
    this.scheduledReminders = [];
  }

  private saveSettings(settings: JournalReminderSettings): void {
    localStorage.setItem('journal_reminder_enabled', settings.enabled.toString());
    localStorage.setItem('journal_reminder_times', JSON.stringify(settings.times));
    if (settings.lastUpdated) {
      localStorage.setItem('journal_reminder_last_updated', settings.lastUpdated);
    }
    this.log('Settings saved:', settings);
  }

  getSettings(): JournalReminderSettings {
    const enabled = localStorage.getItem('journal_reminder_enabled') === 'true';
    const timesStr = localStorage.getItem('journal_reminder_times');
    const lastUpdated = localStorage.getItem('journal_reminder_last_updated') || undefined;
    
    let times: JournalReminderTime[] = [];
    if (timesStr) {
      try {
        times = JSON.parse(timesStr);
      } catch (error) {
        this.error('Error parsing saved times:', error);
      }
    }
    
    return { enabled, times, lastUpdated };
  }

  async testReminder(): Promise<boolean> {
    this.log('Testing journal reminder');
    
    try {
      this.ensureInitialized();
      
      if (this.isNative && Capacitor.getPlatform() === 'android') {
        // Use enhanced Android service for testing
        return await enhancedAndroidNotificationService.testNotification();
      } else if (this.isNative) {
        // Use native notifications for iOS
        const permissions = await LocalNotifications.checkPermissions();
        
        if (permissions.display !== 'granted') {
          this.log('Cannot test reminder - permission not granted');
          return false;
        }

        // Schedule immediate test notification
        await LocalNotifications.schedule({
          notifications: [{
            id: 999,
            title: 'Test Journal Reminder 🧪',
            body: 'This is a test reminder. Your journal reminders are working!',
            schedule: { at: new Date(Date.now() + 2000) }, // 2 seconds from now
            extra: { test: true }
          }]
        });

        return true;
      } else {
        // Web notification test
        if (Notification.permission !== 'granted') {
          return false;
        }

        const notification = new Notification('Test Journal Reminder 🧪', {
          body: 'This is a test reminder. Your journal reminders are working!',
          icon: '/favicon.ico',
          tag: 'test-journal-reminder'
        });

        setTimeout(() => {
          notification.close();
        }, 5000);

        return true;
      }
    } catch (error) {
      this.error('Error testing reminder:', error);
      return false;
    }
  }

  async getNotificationStatus(): Promise<any> {
    console.log('[JournalReminderService] Getting notification status');
    
    try {
      const settings = this.getSettings();
      const baseStatus = {
        enabled: settings.enabled,
        times: settings.times,
        lastUpdated: settings.lastUpdated,
        platform: Capacitor.getPlatform(),
        isNative: this.isNative,
        strategy: this.strategy,
        scheduledReminders: this.scheduledReminders.length,
        healthCheckActive: this.healthCheckInterval !== null
      };

      if (!this.isNative) {
        return {
          ...baseStatus,
          webNotificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
        };
      }

      // For Android, get enhanced status
      if (Capacitor.getPlatform() === 'android') {
        try {
          const androidStatus = await enhancedAndroidNotificationService.getDetailedStatus();
          return {
            ...baseStatus,
            androidEnhancedStatus: androidStatus,
            hasExactAlarmPermission: androidStatus.hasExactAlarmPermission,
            batteryOptimizationDisabled: androidStatus.batteryOptimizationDisabled,
            channelsCreated: androidStatus.channelsCreated,
            doNotDisturbStatus: androidStatus.doNotDisturbStatus
          };
        } catch (error) {
          console.error('[JournalReminderService] Error getting enhanced Android status:', error);
        }
      }

      // Get native notification status (fallback/iOS)
      const permissions = await LocalNotifications.checkPermissions();
      const pending = await LocalNotifications.getPending();
      
      return {
        ...baseStatus,
        nativePermissions: permissions,
        pendingNotifications: pending.notifications.length,
        pendingNotificationIds: pending.notifications.map(n => n.id)
      };
    } catch (error) {
      console.error('[JournalReminderService] Error getting status:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        enabled: false
      };
    }
  }

  private async verifyScheduledReminders(times: JournalReminderTime[]): Promise<boolean> {
    this.log('Verifying scheduled reminders');
    
    // Check if we have the expected number of active reminders
    if (this.scheduledReminders.length !== times.length) {
      this.error(`Reminder count mismatch: expected ${times.length}, got ${this.scheduledReminders.length}`);
      return false;
    }
    
    // For native strategy, also verify with device's notification system
    if (this.isNative) {
      try {
        const result = await LocalNotifications.getPending();
        const pendingNotifications = result.notifications;
        
        this.log(`Device has ${pendingNotifications.length} pending notifications, expected ${times.length}`);
        
        // Check count
        if (pendingNotifications.length < times.length) {
          this.error('Device notification count mismatch', {
            expected: times.length,
            actual: pendingNotifications.length
          });
          return false;
        }
      } catch (error) {
        this.error('Error verifying native notifications:', error);
        return false;
      }
    }
    
    this.log('All reminders verified successfully');
    return true;
  }

  // Health check to ensure reminders are still active
  private startHealthCheck(): void {
    this.stopHealthCheck(); // Clear any existing interval
    
    this.healthCheckInterval = window.setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        this.error('Error during health check:', error);
      }
    }, this.HEALTH_CHECK_INTERVAL);
    
    this.log('Health check started - will verify reminders every 6 hours');
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      this.log('Health check stopped');
    }
  }

  private async performHealthCheck(): Promise<void> {
    const settings = this.getSettings();
    
    if (!settings.enabled || settings.times.length === 0) {
      this.log('Reminders disabled, stopping health check');
      this.stopHealthCheck();
      return;
    }

    // Check permission status
    let permissionGranted = false;
    
    if (this.isNative) {
      try {
        const permissions = await LocalNotifications.checkPermissions();
        permissionGranted = permissions.display === 'granted';
      } catch (error) {
        this.error('Error checking native permissions:', error);
      }
    } else {
      permissionGranted = Notification.permission === 'granted';
    }

    if (!permissionGranted) {
      this.log('Permissions lost during health check, disabling reminders');
      await this.disableReminders();
      return;
    }

    // Verify active reminders are still scheduled correctly
    if (this.scheduledReminders.length !== settings.times.length) {
      this.log('Reminder count mismatch detected, reinitializing', {
        expected: settings.times.length,
        active: this.scheduledReminders.length
      });
      await this.setupReminders(settings.times);
      return;
    }

    this.log('Health check passed', {
      strategy: this.strategy,
      activeReminders: this.scheduledReminders.length,
      expectedReminders: settings.times.length
    });
  }

  // Initialize reminders when app starts if they were previously enabled
  async initializeOnAppStart(): Promise<void> {
    this.log('Initializing reminders on app start');
    
    try {
      this.ensureInitialized();
      
      const settings = this.getSettings();
      
      if (settings.enabled && settings.times.length > 0) {
        this.log('Reminders were enabled, reinitializing');
        await this.requestPermissionsAndSetup(settings.times);
      }
    } catch (error) {
      this.error('Error initializing reminders on app start:', error);
    }
  }
}

export const journalReminderService = JournalReminderService.getInstance();