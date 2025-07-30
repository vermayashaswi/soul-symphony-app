import { enhancedNotificationService } from './enhancedNotificationService';
import { enhancedPlatformService } from './enhancedPlatformService';
import { serviceWorkerManager } from '@/utils/serviceWorker';
import { LocalNotifications } from '@capacitor/local-notifications';

export type JournalReminderTime = 'morning' | 'afternoon' | 'evening' | 'night';

interface JournalReminderSettings {
  enabled: boolean;
  times: JournalReminderTime[];
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
  private activeReminders: ScheduledReminder[] = [];
  private healthCheckInterval?: number;
  private readonly HEALTH_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
  private isInitialized = false;
  
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

  private log(message: string, data?: any): void {
    console.log(`[JournalReminderService] ${message}`, data);
  }

  private error(message: string, error?: any): void {
    console.error(`[JournalReminderService] ${message}`, error);
  }

  async requestPermissionsAndSetup(times: JournalReminderTime[]): Promise<boolean> {
    this.log('User requested journal reminder setup', { times });
    
    try {
      // Initialize platform detection first
      await this.ensureInitialized();
      
      // Request notification permissions
      const permissionResult = await enhancedNotificationService.requestPermissions();
      
      if (!permissionResult.granted) {
        this.error('Notification permissions not granted:', permissionResult.error);
        return false;
      }

      this.log('Permissions granted, setting up reminders');
      
      // Save settings
      this.saveSettings({ enabled: true, times });
      
      // Setup reminders with simplified strategy
      await this.setupReminders(times);
      
      // Immediate verification that reminders are scheduled
      const verified = await this.verifyScheduledReminders(times);
      if (!verified) {
        this.error('Failed to verify scheduled reminders');
        return false;
      }
      
      return true;
    } catch (error) {
      this.error('Error setting up journal reminders:', error);
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

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.log('Initializing journal reminder service');
    
    try {
      // Initialize platform detection
      await enhancedPlatformService.detectPlatform();
      this.setupAppLifecycleHandlers();
      this.isInitialized = true;
      this.log('Service initialized successfully');
    } catch (error) {
      this.error('Failed to initialize service:', error);
      throw error;
    }
  }

  private async setupReminders(times: JournalReminderTime[]): Promise<void> {
    this.log('Setting up reminders for times:', times);
    
    // Clear existing reminders first
    await this.clearAllReminders();
    
    // Use simplified strategy - prefer native, fallback to web only
    const strategy = enhancedPlatformService.getBestNotificationStrategy();
    this.log('Using notification strategy:', strategy);
    
    if (strategy === 'native') {
      await this.setupNativeReminders(times);
    } else {
      // Simplified fallback - only use web reminders
      this.setupWebReminders(times);
    }
    
    // Start health check to monitor reminder status
    this.startHealthCheck();
  }

  private async setupNativeReminders(times: JournalReminderTime[]): Promise<void> {
    try {
      this.log('Setting up native reminders with daily recurrence');
      
      // Cancel existing notifications
      await LocalNotifications.cancel({ notifications: [] });

      // Schedule recurring daily notifications
      const notifications = times.map((time, index) => {
        const { hour, minute } = this.TIME_MAPPINGS[time];
        
        return {
          id: index + 1,
          title: this.getNotificationTitle(time),
          body: this.getNotificationBody(time),
          schedule: {
            at: new Date(Date.now() + 5000), // First notification in 5 seconds for immediate test
            every: 'day' as const,
            on: {
              hour,
              minute
            }
          },
          sound: 'default',
          actionTypeId: 'JOURNAL_REMINDER',
          extra: {
            time,
            scheduledDaily: true,
            action: 'open_journal'
          }
        };
      });

      await LocalNotifications.schedule({ notifications });
      
      // Verify notifications were scheduled
      const pending = await LocalNotifications.getPending();
      this.log(`Scheduled ${notifications.length} notifications, verified ${pending.notifications.length} pending`);
      
      // Track reminders
      times.forEach((time, index) => {
        this.activeReminders.push({
          id: `native-${time}`,
          time,
          scheduledFor: this.getNextReminderTime(time),
          strategy: 'native'
        });
      });
      
      // Verify scheduling was successful
      if (pending.notifications.length !== notifications.length) {
        throw new Error(`Notification scheduling verification failed: expected ${notifications.length}, got ${pending.notifications.length}`);
      }
      
      this.log(`Successfully scheduled ${notifications.length} native recurring reminders`);
      
    } catch (error) {
      this.error('Error setting up native reminders:', error);
      // Fallback to service worker reminders
      await this.setupServiceWorkerReminders(times);
    }
  }

  // Native notifications now use daily recurrence, no manual rescheduling needed
  private async verifyNativeNotifications(times: JournalReminderTime[]): Promise<boolean> {
    try {
      const pending = await LocalNotifications.getPending();
      this.log(`Verifying native notifications: ${pending.notifications.length} pending`);
      
      // Check that we have the expected number of notifications
      if (pending.notifications.length !== times.length) {
        this.error(`Native notification count mismatch: expected ${times.length}, got ${pending.notifications.length}`);
        return false;
      }
      
      // Verify each notification has the correct configuration
      for (let i = 0; i < times.length; i++) {
        const time = times[i];
        const notification = pending.notifications.find(n => n.extra?.time === time);
        
        if (!notification) {
          this.error(`Missing native notification for time: ${time}`);
          return false;
        }
        
        if (!notification.extra?.scheduledDaily) {
          this.error(`Native notification for ${time} not configured for daily recurrence`);
          return false;
        }
      }
      
      this.log('All native notifications verified successfully');
      return true;
      
    } catch (error) {
      this.error('Error verifying native notifications:', error);
      return false;
    }
  }

  private async setupServiceWorkerReminders(times: JournalReminderTime[]): Promise<void> {
    try {
      this.log('Setting up service worker reminders');
      
      // Clear any existing service worker reminders
      await serviceWorkerManager.clearJournalReminders();
      
      // Schedule reminders through service worker
      for (const time of times) {
        const scheduledFor = this.getNextReminderTime(time);
        const delay = scheduledFor.getTime() - Date.now();
        
        const success = await serviceWorkerManager.scheduleJournalReminder(time, delay);
        
        if (success) {
          this.activeReminders.push({
            id: `sw-${time}`,
            time,
            scheduledFor,
            strategy: 'serviceWorker'
          });
          this.log(`Scheduled service worker reminder for ${time} at ${scheduledFor.toLocaleString()}`);
        } else {
          this.error(`Failed to schedule service worker reminder for ${time}`);
        }
      }
      
      this.log(`Scheduled ${this.activeReminders.length} service worker reminders`);
      
    } catch (error) {
      this.error('Error setting up service worker reminders:', error);
      // Fallback to web reminders
      this.setupWebReminders(times);
    }
  }

  private setupWebReminders(times: JournalReminderTime[]): void {
    this.log('Setting up web reminders');
    
    times.forEach(time => {
      const reminder = this.scheduleWebReminder(time);
      this.activeReminders.push(reminder);
    });
    
    this.log(`Scheduled ${this.activeReminders.length} web reminders`);
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
      const index = this.activeReminders.findIndex(r => r.id === id);
      if (index !== -1) {
        this.activeReminders[index] = nextReminder;
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
    this.activeReminders.forEach(reminder => {
      if (reminder.timeoutId) {
        clearTimeout(reminder.timeoutId);
      }
    });
    
    // Clear service worker reminders
    await serviceWorkerManager.clearJournalReminders();
    
    // Clear native reminders if running natively
    if (enhancedPlatformService.canUseNativeNotifications()) {
      try {
        // Get pending notifications first for logging
        const pending = await LocalNotifications.getPending();
        this.log(`Cancelling ${pending.notifications.length} native notifications`);
        
        await LocalNotifications.cancel({ notifications: [] });
        
        // Verify cancellation
        const afterCancel = await LocalNotifications.getPending();
        if (afterCancel.notifications.length > 0) {
          this.error(`Failed to cancel all notifications: ${afterCancel.notifications.length} still pending`);
        } else {
          this.log('Successfully cancelled all native reminders');
        }
      } catch (error) {
        this.error('Error cancelling native reminders:', error);
      }
    }
    
    this.activeReminders = [];
  }

  private saveSettings(settings: JournalReminderSettings): void {
    localStorage.setItem('journal_reminder_enabled', settings.enabled.toString());
    localStorage.setItem('journal_reminder_times', JSON.stringify(settings.times));
    this.log('Settings saved:', settings);
  }

  getSettings(): JournalReminderSettings {
    const enabled = localStorage.getItem('journal_reminder_enabled') === 'true';
    const timesStr = localStorage.getItem('journal_reminder_times');
    
    let times: JournalReminderTime[] = [];
    if (timesStr) {
      try {
        times = JSON.parse(timesStr);
      } catch (error) {
        this.error('Error parsing saved times:', error);
      }
    }
    
    return { enabled, times };
  }

  // Debug method to get current notification status
  async getNotificationStatus(): Promise<{
    settings: JournalReminderSettings;
    activeReminders: number;
    pendingNativeNotifications: number;
    permissionState: string;
    strategy: string;
    isNativeSupported: boolean;
  }> {
    await this.ensureInitialized();
    
    const settings = this.getSettings();
    const permissionState = await enhancedNotificationService.checkPermissionStatus();
    const strategy = enhancedPlatformService.getBestNotificationStrategy();
    const isNativeSupported = enhancedPlatformService.canUseNativeNotifications();
    
    let pendingNativeNotifications = 0;
    if (isNativeSupported) {
      try {
        const pending = await LocalNotifications.getPending();
        pendingNativeNotifications = pending.notifications.length;
      } catch (error) {
        this.error('Error getting pending notifications:', error);
      }
    }
    
    return {
      settings,
      activeReminders: this.activeReminders.length,
      pendingNativeNotifications,
      permissionState,
      strategy,
      isNativeSupported
    };
  }

  async testReminder(): Promise<boolean> {
    this.log('Testing journal reminder');
    
    try {
      await this.ensureInitialized();
      
      const permissionState = await enhancedNotificationService.checkPermissionStatus();
      
      if (permissionState !== 'granted') {
        this.log('Cannot test reminder - permission not granted:', permissionState);
        return false;
      }

      const strategy = enhancedPlatformService.getBestNotificationStrategy();
      
      switch (strategy) {
        case 'native':
          return await this.testNativeReminder();
        case 'serviceWorker':
        case 'web':
          return this.testWebReminder();
        default:
          this.error('No notification strategy available for testing');
          return false;
      }
    } catch (error) {
      this.error('Error testing reminder:', error);
      return false;
    }
  }

  private async testNativeReminder(): Promise<boolean> {
    try {
      // Schedule a test notification for 3 seconds from now
      await LocalNotifications.schedule({
        notifications: [{
          id: 999,
          title: 'Test Journal Reminder 🧪',
          body: 'This is a test reminder. Your journal reminders are working!',
          schedule: { at: new Date(Date.now() + 3000) }, // 3 seconds from now
          extra: { test: true }
        }]
      });

      // Verify it was scheduled
      const pending = await LocalNotifications.getPending();
      const testNotification = pending.notifications.find(n => n.id === 999);
      
      if (!testNotification) {
        throw new Error('Test notification was not found in pending notifications');
      }

      this.log('Native test reminder scheduled and verified');
      
      // Clean up test notification after 10 seconds
      setTimeout(async () => {
        try {
          await LocalNotifications.cancel({ notifications: [{ id: 999 }] });
          this.log('Test notification cleaned up');
        } catch (error) {
          this.error('Error cleaning up test notification:', error);
        }
      }, 10000);
      
      return true;
    } catch (error) {
      this.error('Error with native test reminder:', error);
      return this.testWebReminder();
    }
  }

  private testWebReminder(): boolean {
    try {
      this.showWebTestNotification();
      return true;
    } catch (error) {
      this.error('Error with web test reminder:', error);
      return false;
    }
  }

  private showWebTestNotification(): void {
    const notification = new Notification('Test Journal Reminder 🧪', {
      body: 'This is a test reminder. Your journal reminders are working!',
      icon: '/favicon.ico',
      tag: 'test-journal-reminder'
    });

    setTimeout(() => {
      notification.close();
    }, 5000);

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
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
    
    this.log('Health check started');
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
    const permissionState = await enhancedNotificationService.checkPermissionStatus();
    if (permissionState !== 'granted') {
      this.log('Permissions lost during health check, disabling reminders');
      await this.disableReminders();
      return;
    }

    // For native notifications, check system-level pending notifications
    if (enhancedPlatformService.canUseNativeNotifications()) {
      try {
        const pending = await LocalNotifications.getPending();
        const expectedCount = settings.times.length;
        
        if (pending.notifications.length !== expectedCount) {
          this.log(`Native notification health check failed: expected ${expectedCount}, found ${pending.notifications.length}. Reinitializing.`);
          await this.setupReminders(settings.times);
          return;
        }
        
        // Verify each expected notification exists
        for (const time of settings.times) {
          const notification = pending.notifications.find(n => n.extra?.time === time);
          if (!notification) {
            this.log(`Missing native notification for ${time}. Reinitializing.`);
            await this.setupReminders(settings.times);
            return;
          }
        }
        
        this.log('Native notification health check passed', {
          pendingNotifications: pending.notifications.length,
          expectedReminders: settings.times.length
        });
        
      } catch (error) {
        this.error('Error during native notification health check:', error);
        await this.setupReminders(settings.times);
      }
    } else {
      // For non-native reminders, verify active reminders count
      if (this.activeReminders.length !== settings.times.length) {
        this.log('Reminder count mismatch detected, reinitializing', {
          expected: settings.times.length,
          active: this.activeReminders.length
        });
        await this.setupReminders(settings.times);
      }
    }

    this.log('Health check passed', {
      activeReminders: this.activeReminders.length,
      expectedReminders: settings.times.length
    });
  }

  private async verifyScheduledReminders(times: JournalReminderTime[]): Promise<boolean> {
    this.log('Verifying scheduled reminders');
    
    // Check if we have the expected number of active reminders
    if (this.activeReminders.length !== times.length) {
      this.error(`Reminder count mismatch: expected ${times.length}, got ${this.activeReminders.length}`);
      return false;
    }
    
    // For native notifications, verify with the system
    if (enhancedPlatformService.canUseNativeNotifications()) {
      const nativeVerified = await this.verifyNativeNotifications(times);
      if (!nativeVerified) {
        return false;
      }
    }
    
    // Verify each reminder is properly scheduled
    for (const time of times) {
      const reminder = this.activeReminders.find(r => r.time === time);
      if (!reminder) {
        this.error(`Missing reminder for time: ${time}`);
        return false;
      }
      
      // For non-native reminders, check if the scheduled time is in the future
      if (reminder.strategy !== 'native' && reminder.scheduledFor.getTime() <= Date.now()) {
        this.error(`Reminder for ${time} scheduled in the past: ${reminder.scheduledFor.toLocaleString()}`);
        return false;
      }
    }
    
    this.log('All reminders verified successfully');
    return true;
  }

  // Add app lifecycle handlers for better persistence
  private setupAppLifecycleHandlers(): void {
    // Handle visibility change (app backgrounding/foregrounding)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // App came to foreground, verify reminders
        setTimeout(async () => {
          const settings = this.getSettings();
          if (settings.enabled && settings.times.length > 0) {
            this.log('App foregrounded, checking reminders');
            await this.setupReminders(settings.times);
          }
        }, 1000);
      }
    });

    // Handle page unload (app closing)
    window.addEventListener('beforeunload', () => {
      this.log('App closing, preserving reminder settings');
    });
  }

  // Initialize reminders on app start if enabled
  async initializeOnAppStart(): Promise<void> {
    try {
      await this.ensureInitialized();
      
      const settings = this.getSettings();
      
      if (settings.enabled && settings.times.length > 0) {
        this.log('Initializing reminders on app start', settings);
        
        // Check if permissions are still granted
        const permissionState = await enhancedNotificationService.checkPermissionStatus();
        
        if (permissionState === 'granted') {
          await this.setupReminders(settings.times);
        } else {
          this.log('Permissions no longer granted, disabling reminders');
          this.saveSettings({ enabled: false, times: [] });
        }
      }
    } catch (error) {
      this.error('Error initializing reminders on app start:', error);
    }
  }
}

export const journalReminderService = JournalReminderService.getInstance();