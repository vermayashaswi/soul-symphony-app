import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { notificationSettingsService } from './notificationSettingsService';
import { enhancedAndroidNotificationService } from './enhancedAndroidNotificationService';
import { enhancedNotificationService } from './enhancedNotificationService';
import { 
  JournalReminderTime, 
  ServiceReminderSettings, 
  DEFAULT_TIME_MAPPINGS,
  NotificationSettings
} from '@/types/notifications';

interface NotificationStatus {
  enabled: boolean;
  platform: string;
  strategy: 'android-enhanced' | 'native' | 'web';
  permissionsGranted: boolean;
  scheduledCount: number;
  batteryOptimizationDisabled?: boolean;
  exactAlarmPermission?: boolean;
  error?: string;
}

class UnifiedNotificationService {
  private static instance: UnifiedNotificationService;
  private isNative = false;
  private strategy: 'android-enhanced' | 'native' | 'web' = 'web';
  private healthCheckInterval?: number;
  private readonly HEALTH_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

  static getInstance(): UnifiedNotificationService {
    if (!UnifiedNotificationService.instance) {
      UnifiedNotificationService.instance = new UnifiedNotificationService();
    }
    return UnifiedNotificationService.instance;
  }

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.strategy = this.determineStrategy();
    this.log('Initialized with strategy:', this.strategy);
  }

  private determineStrategy(): 'android-enhanced' | 'native' | 'web' {
    if (!this.isNative) return 'web';
    if (Capacitor.getPlatform() === 'android') return 'android-enhanced';
    return 'native';
  }

  private log(message: string, data?: any): void {
    console.log(`[UnifiedNotificationService] ${message}`, data);
  }

  private error(message: string, error?: any): void {
    console.error(`[UnifiedNotificationService] ${message}`, error);
  }

  // Main method to enable reminders with comprehensive setup
  async enableReminders(times: JournalReminderTime[], customTimes?: { [key in JournalReminderTime]: string }): Promise<boolean> {
    this.log('Enabling reminders with strategy:', { strategy: this.strategy, times, customTimes });

    try {
      // First, save settings to database
      const settings: ServiceReminderSettings = {
        enabled: true,
        times,
        lastUpdated: new Date().toISOString()
      };

      const saveSuccess = await notificationSettingsService.saveSettings(settings);
      if (!saveSuccess) {
        this.error('Failed to save settings');
        return false;
      }

      // Clear any existing reminders
      await this.clearAllReminders();

      // Set up reminders based on strategy
      let success = false;
      switch (this.strategy) {
        case 'android-enhanced':
          success = await this.setupAndroidEnhancedReminders(times, customTimes);
          break;
        case 'native':
          success = await this.setupNativeReminders(times, customTimes);
          break;
        case 'web':
          success = await this.setupWebReminders(times, customTimes);
          break;
      }

      if (success) {
        this.startHealthCheck();
        this.log('Reminders enabled successfully');
      } else {
        this.error('Failed to enable reminders');
      }

      return success;
    } catch (error) {
      this.error('Error enabling reminders:', error);
      return false;
    }
  }

  // Disable reminders completely
  async disableReminders(): Promise<void> {
    this.log('Disabling reminders');

    try {
      // Clear all active reminders
      await this.clearAllReminders();

      // Stop health check
      this.stopHealthCheck();

      // Save disabled state
      const settings: ServiceReminderSettings = {
        enabled: false,
        times: [],
        lastUpdated: new Date().toISOString()
      };

      await notificationSettingsService.saveSettings(settings);
      this.log('Reminders disabled successfully');
    } catch (error) {
      this.error('Error disabling reminders:', error);
    }
  }

  // Android enhanced setup
  private async setupAndroidEnhancedReminders(times: JournalReminderTime[], customTimes?: { [key in JournalReminderTime]: string }): Promise<boolean> {
    this.log('Setting up Android enhanced reminders');

    try {
      // Request all permissions
      const permissionResult = await enhancedAndroidNotificationService.requestAllPermissions();
      if (!permissionResult.success) {
        this.error('Android enhanced permissions failed:', permissionResult.error);
        return false;
      }

      // Schedule reminders with custom times if provided
      const scheduleResult = await enhancedAndroidNotificationService.scheduleJournalReminders(times);
      
      if (scheduleResult.success) {
        this.log('Android enhanced reminders scheduled successfully');
        return true;
      } else {
        this.error('Android enhanced scheduling failed:', scheduleResult.error);
        return false;
      }
    } catch (error) {
      this.error('Error in Android enhanced setup:', error);
      return false;
    }
  }

  // Native setup for iOS and fallback Android
  private async setupNativeReminders(times: JournalReminderTime[], customTimes?: { [key in JournalReminderTime]: string }): Promise<boolean> {
    this.log('Setting up native reminders');

    try {
      // Request permissions
      const permissions = await LocalNotifications.requestPermissions();
      if (permissions.display !== 'granted') {
        this.error('Native notification permissions not granted');
        return false;
      }

      // Cancel existing notifications
      await LocalNotifications.cancel({ notifications: [] });

      // Get current settings for custom times
      const currentSettings = await notificationSettingsService.loadSettings();
      const fullSettings = customTimes ? await this.loadFullSettingsWithCustomTimes(customTimes) : null;

      // Schedule new notifications
      const notifications = times.map((time, index) => {
        const timeMapping = this.getTimeMapping(time, fullSettings);
        
        return {
          id: index + 1000, // Use high IDs to avoid conflicts
          title: this.getNotificationTitle(time),
          body: this.getNotificationBody(time),
          schedule: {
            on: {
              hour: timeMapping.hour,
              minute: timeMapping.minute
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
      this.log(`Scheduled ${notifications.length} native reminders`);

      // Verify scheduling
      setTimeout(async () => {
        const pending = await LocalNotifications.getPending();
        this.log(`Verification: ${pending.notifications.length} native notifications pending`);
      }, 1000);

      return true;
    } catch (error) {
      this.error('Error setting up native reminders:', error);
      return false;
    }
  }

  // Web setup
  private async setupWebReminders(times: JournalReminderTime[], customTimes?: { [key in JournalReminderTime]: string }): Promise<boolean> {
    this.log('Setting up web reminders');

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.error('Web notification permission denied');
        return false;
      }

      // Clear existing timeouts
      this.clearWebTimeouts();

      // Load custom times
      const fullSettings = customTimes ? await this.loadFullSettingsWithCustomTimes(customTimes) : null;

      // Schedule web reminders
      times.forEach(time => {
        this.scheduleWebReminder(time, fullSettings);
      });

      this.log(`Scheduled ${times.length} web reminders`);
      return true;
    } catch (error) {
      this.error('Error setting up web reminders:', error);
      return false;
    }
  }

  private scheduleWebReminder(time: JournalReminderTime, fullSettings?: NotificationSettings | null): void {
    const timeMapping = this.getTimeMapping(time, fullSettings);
    const nextTime = this.getNextReminderTime(timeMapping.hour, timeMapping.minute);
    const delay = nextTime.getTime() - Date.now();

    if (delay > 0) {
      const timeoutId = window.setTimeout(() => {
        this.showWebNotification(time);
        // Reschedule for next day
        this.scheduleWebReminder(time, fullSettings);
      }, delay);

      // Store timeout ID for cleanup
      const timeouts = this.getStoredTimeouts();
      timeouts.push(timeoutId);
      localStorage.setItem('web_reminder_timeouts', JSON.stringify(timeouts));
    }
  }

  private showWebNotification(time: JournalReminderTime): void {
    if (Notification.permission === 'granted') {
      const notification = new Notification(this.getNotificationTitle(time), {
        body: this.getNotificationBody(time),
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `journal-reminder-${time}`,
        requireInteraction: false
      });

      // Auto close after 8 seconds
      setTimeout(() => notification.close(), 8000);

      // Handle click
      notification.onclick = () => {
        window.focus();
        window.location.href = '/app/voice-entry';
        notification.close();
      };
    }
  }

  private getTimeMapping(time: JournalReminderTime, fullSettings?: NotificationSettings | null): { hour: number; minute: number } {
    if (fullSettings) {
      return notificationSettingsService.getCustomTime(fullSettings, time);
    }
    return DEFAULT_TIME_MAPPINGS[time];
  }

  private async loadFullSettingsWithCustomTimes(customTimes: { [key in JournalReminderTime]: string }): Promise<NotificationSettings> {
    return {
      enabled: true,
      morning: true,
      afternoon: true,
      evening: true,
      night: true,
      morningTime: customTimes.morning,
      afternoonTime: customTimes.afternoon,
      eveningTime: customTimes.evening,
      nightTime: customTimes.night,
      lastUpdated: new Date().toISOString()
    };
  }

  private getNextReminderTime(hour: number, minute: number): Date {
    const now = new Date();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);

    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next;
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

  // Clear all reminders across platforms
  private async clearAllReminders(): Promise<void> {
    this.log('Clearing all reminders');

    try {
      // Clear web timeouts
      this.clearWebTimeouts();

      // Clear native notifications
      if (this.isNative) {
        await LocalNotifications.cancel({ notifications: [] });
        await LocalNotifications.removeAllDeliveredNotifications();
      }

      // Clear Android enhanced notifications
      if (this.strategy === 'android-enhanced') {
        await enhancedAndroidNotificationService.clearAllNotifications();
      }

      this.log('All reminders cleared');
    } catch (error) {
      this.error('Error clearing reminders:', error);
    }
  }

  private clearWebTimeouts(): void {
    const timeouts = this.getStoredTimeouts();
    timeouts.forEach(id => window.clearTimeout(id));
    localStorage.removeItem('web_reminder_timeouts');
  }

  private getStoredTimeouts(): any[] {
    try {
      const stored = localStorage.getItem('web_reminder_timeouts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // Health check to ensure reminders stay active
  private startHealthCheck(): void {
    this.stopHealthCheck();
    this.healthCheckInterval = window.setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  private async performHealthCheck(): Promise<void> {
    this.log('Performing health check');

    try {
      const settings = await notificationSettingsService.loadSettings();
      
      if (!settings.enabled) {
        this.log('Reminders disabled, stopping health check');
        this.stopHealthCheck();
        return;
      }

      // Check if reminders are still scheduled
      const status = await this.getNotificationStatus();
      
      if (status.scheduledCount === 0 && settings.times.length > 0) {
        this.log('No reminders scheduled, re-enabling');
        await this.enableReminders(settings.times);
      }
    } catch (error) {
      this.error('Health check failed:', error);
    }
  }

  // Test notification
  async testNotification(): Promise<boolean> {
    this.log('Testing notification with strategy:', this.strategy);

    try {
      switch (this.strategy) {
        case 'android-enhanced':
          return await enhancedAndroidNotificationService.testNotification();
        case 'native':
          return await this.testNativeNotification();
        case 'web':
          return this.testWebNotification();
        default:
          return false;
      }
    } catch (error) {
      this.error('Error testing notification:', error);
      return false;
    }
  }

  private async testNativeNotification(): Promise<boolean> {
    try {
      const permissions = await LocalNotifications.checkPermissions();
      if (permissions.display !== 'granted') return false;

      await LocalNotifications.schedule({
        notifications: [{
          id: 9999,
          title: 'Test Journal Reminder 🧪',
          body: 'Your journal reminders are working!',
          schedule: { at: new Date(Date.now() + 2000) }
        }]
      });

      return true;
    } catch (error) {
      this.error('Native test notification failed:', error);
      return false;
    }
  }

  private testWebNotification(): boolean {
    try {
      if (Notification.permission !== 'granted') return false;

      const notification = new Notification('Test Journal Reminder 🧪', {
        body: 'Your journal reminders are working!',
        icon: '/favicon.ico'
      });

      setTimeout(() => notification.close(), 5000);
      return true;
    } catch (error) {
      this.error('Web test notification failed:', error);
      return false;
    }
  }

  // Get comprehensive notification status
  async getNotificationStatus(): Promise<NotificationStatus> {
    this.log('Getting notification status');

    try {
      const settings = await notificationSettingsService.loadSettings();
      const baseStatus: NotificationStatus = {
        enabled: settings.enabled,
        platform: Capacitor.getPlatform(),
        strategy: this.strategy,
        permissionsGranted: false,
        scheduledCount: 0
      };

      switch (this.strategy) {
        case 'android-enhanced':
          return await this.getAndroidEnhancedStatus(baseStatus);
        case 'native':
          return await this.getNativeStatus(baseStatus);
        case 'web':
          return this.getWebStatus(baseStatus);
        default:
          return baseStatus;
      }
    } catch (error) {
      this.error('Error getting status:', error);
      return {
        enabled: false,
        platform: 'unknown',
        strategy: this.strategy,
        permissionsGranted: false,
        scheduledCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async getAndroidEnhancedStatus(baseStatus: NotificationStatus): Promise<NotificationStatus> {
    const androidStatus = await enhancedAndroidNotificationService.getDetailedStatus();
    return {
      ...baseStatus,
      permissionsGranted: androidStatus.hasNotificationPermission,
      scheduledCount: androidStatus.scheduledCount,
      batteryOptimizationDisabled: androidStatus.batteryOptimizationDisabled,
      exactAlarmPermission: androidStatus.hasExactAlarmPermission,
      error: androidStatus.lastError
    };
  }

  private async getNativeStatus(baseStatus: NotificationStatus): Promise<NotificationStatus> {
    const permissions = await LocalNotifications.checkPermissions();
    const pending = await LocalNotifications.getPending();
    
    return {
      ...baseStatus,
      permissionsGranted: permissions.display === 'granted',
      scheduledCount: pending.notifications.length
    };
  }

  private getWebStatus(baseStatus: NotificationStatus): NotificationStatus {
    return {
      ...baseStatus,
      permissionsGranted: Notification.permission === 'granted',
      scheduledCount: this.getStoredTimeouts().length
    };
  }

  // Initialize on app start
  async initializeOnAppStart(): Promise<void> {
    this.log('Initializing on app start');

    try {
      const settings = await notificationSettingsService.loadSettings();
      
      if (settings.enabled && settings.times.length > 0) {
        this.log('Re-enabling reminders on app start');
        await this.enableReminders(settings.times);
      }
    } catch (error) {
      this.error('Error initializing on app start:', error);
    }
  }
}

export const unifiedNotificationService = UnifiedNotificationService.getInstance();