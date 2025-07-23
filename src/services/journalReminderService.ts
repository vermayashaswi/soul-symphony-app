
import { enhancedNotificationService } from './enhancedNotificationService';
import { nativeIntegrationService } from './nativeIntegrationService';

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
}

class JournalReminderService {
  private static instance: JournalReminderService;
  private activeReminders: ScheduledReminder[] = [];
  
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
      // Request notification permissions first
      const permissionResult = await enhancedNotificationService.requestPermissions();
      
      if (!permissionResult.granted) {
        this.error('Notification permissions not granted:', permissionResult.error);
        return false;
      }

      this.log('Permissions granted, setting up reminders');
      
      // Save settings
      this.saveSettings({ enabled: true, times });
      
      // Setup reminders
      await this.setupReminders(times);
      
      return true;
    } catch (error) {
      this.error('Error setting up journal reminders:', error);
      return false;
    }
  }

  async disableReminders(): Promise<void> {
    this.log('Disabling journal reminders');
    
    // Clear all active reminders
    this.clearAllReminders();
    
    // Save disabled state
    this.saveSettings({ enabled: false, times: [] });
    
    // Cancel native notifications if applicable
    if (nativeIntegrationService.isRunningNatively()) {
      await this.cancelNativeReminders();
    }
  }

  private async setupReminders(times: JournalReminderTime[]): Promise<void> {
    this.log('Setting up reminders for times:', times);
    
    // Clear existing reminders first
    this.clearAllReminders();
    
    if (nativeIntegrationService.isRunningNatively()) {
      await this.setupNativeReminders(times);
    } else {
      this.setupWebReminders(times);
    }
  }

  private async setupNativeReminders(times: JournalReminderTime[]): Promise<void> {
    try {
      this.log('Setting up native reminders');
      
      const localNotifications = nativeIntegrationService.getPlugin('LocalNotifications');
      if (!localNotifications) {
        this.log('LocalNotifications plugin not available, falling back to web');
        this.setupWebReminders(times);
        return;
      }

      // Cancel existing notifications
      await localNotifications.cancel({ notifications: [] });

      // Schedule new notifications
      const notifications = times.map((time, index) => {
        const scheduledDate = this.getNextReminderTime(time);
        
        return {
          id: index + 1,
          title: 'Journal Reminder 📝',
          body: "Time to reflect on your day. Open SOULo and capture your thoughts.",
          schedule: {
            at: scheduledDate,
            repeats: true,
            every: 'day' as const
          },
          sound: 'default',
          actionTypeId: 'JOURNAL_REMINDER',
          extra: {
            time,
            scheduledFor: scheduledDate.toISOString(),
            action: 'open_journal'
          }
        };
      });

      await localNotifications.schedule({ notifications });
      this.log(`Scheduled ${notifications.length} native reminders`);
      
    } catch (error) {
      this.error('Error setting up native reminders:', error);
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
    const id = `${time}-${Date.now()}`;
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
    
    return { id, time, scheduledFor, timeoutId };
  }

  private showWebNotification(time: JournalReminderTime): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      this.log('Cannot show web notification - permission not granted');
      return;
    }

    const notification = new Notification('Journal Reminder 📝', {
      body: "Time to reflect on your day. Open SOULo and capture your thoughts.",
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
      
      // Check if user is signed in by looking for auth token
      const hasAuth = localStorage.getItem('sb-' + window.location.hostname.replace(/\./g, '-') + '-auth-token') !== null;
      
      // Navigate based on auth status
      if (hasAuth) {
        window.location.href = '/app/home';
      } else {
        window.location.href = '/app/onboarding';
      }
    };
  }

  private getNextReminderTime(time: JournalReminderTime): Date {
    const now = new Date();
    const next = new Date();
    const { hour, minute } = this.TIME_MAPPINGS[time];
    
    next.setHours(hour, minute, 0, 0);
    
    // If the time has already passed today, schedule for tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    
    return next;
  }

  private clearAllReminders(): void {
    this.log('Clearing all active reminders');
    
    this.activeReminders.forEach(reminder => {
      if (reminder.timeoutId) {
        clearTimeout(reminder.timeoutId);
      }
    });
    
    this.activeReminders = [];
  }

  private async cancelNativeReminders(): Promise<void> {
    try {
      const localNotifications = nativeIntegrationService.getPlugin('LocalNotifications');
      if (localNotifications) {
        await localNotifications.cancel({ notifications: [] });
        this.log('Cancelled all native reminders');
      }
    } catch (error) {
      this.error('Error cancelling native reminders:', error);
    }
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

  async testReminder(): Promise<boolean> {
    this.log('Testing journal reminder');
    
    try {
      const permissionState = await enhancedNotificationService.checkPermissionStatus();
      
      if (permissionState !== 'granted') {
        this.log('Cannot test reminder - permission not granted:', permissionState);
        return false;
      }

      if (nativeIntegrationService.isRunningNatively()) {
        return await this.testNativeReminder();
      } else {
        return this.testWebReminder();
      }
    } catch (error) {
      this.error('Error testing reminder:', error);
      return false;
    }
  }

  private async testNativeReminder(): Promise<boolean> {
    try {
      const localNotifications = nativeIntegrationService.getPlugin('LocalNotifications');
      if (!localNotifications) {
        this.log('LocalNotifications not available, testing web reminder');
        return this.testWebReminder();
      }

      await localNotifications.schedule({
        notifications: [{
          id: 999,
          title: 'Test Journal Reminder 🧪',
          body: 'This is a test reminder. Your journal reminders are working!',
          schedule: { at: new Date(Date.now() + 2000) }, // 2 seconds from now
          extra: { test: true }
        }]
      });

      this.log('Native test reminder scheduled');
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

  // Initialize reminders on app start if enabled
  async initializeOnAppStart(): Promise<void> {
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
  }
}

export const journalReminderService = JournalReminderService.getInstance();
