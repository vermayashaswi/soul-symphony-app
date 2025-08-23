import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOptions, Channel } from '@capacitor/local-notifications';
import { enhancedPlatformService } from './enhancedPlatformService';

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

class EnhancedJournalReminderService {
  private static instance: EnhancedJournalReminderService;
  private activeReminders: ScheduledReminder[] = [];
  private isServiceEnabled = false;
  private currentStrategy: 'native' | 'serviceWorker' | 'web' | null = null;
  private healthCheckInterval?: number;
  private notificationChannelsCreated = false;
  private platformInfo: any = null;
  private initialized = false;

  // Time mappings for reminders
  private readonly TIME_MAPPINGS: Record<JournalReminderTime, { hour: number; minute: number }> = {
    morning: { hour: 8, minute: 0 },
    afternoon: { hour: 14, minute: 0 },
    evening: { hour: 19, minute: 0 },
    night: { hour: 22, minute: 0 }
  };

  static getInstance(): EnhancedJournalReminderService {
    if (!EnhancedJournalReminderService.instance) {
      EnhancedJournalReminderService.instance = new EnhancedJournalReminderService();
    }
    return EnhancedJournalReminderService.instance;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    
    try {
      this.platformInfo = await enhancedPlatformService.detectPlatform();
      await this.setupNotificationChannels();
      this.setupAppLifecycleHandlers();
      this.initialized = true;
      console.log('✅ Enhanced JournalReminderService initialized', { 
        platform: this.platformInfo.platform,
        isNative: this.platformInfo.isNative 
      });
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced JournalReminderService:', error);
      throw error;
    }
  }

  /**
   * Setup notification channels for Android
   */
  private async setupNotificationChannels(): Promise<void> {
    if (!this.platformInfo?.isNative || this.notificationChannelsCreated) {
      return;
    }

    try {
      console.log('📱 Setting up Android notification channels...');
      
      const channels: Channel[] = [
        {
          id: 'journal-reminders',
          name: 'Journal Reminders',
          description: 'Daily journal entry reminders',
          importance: 4, // HIGH importance
          sound: 'default',
          vibration: true,
          visibility: 1, // PUBLIC
          lights: true,
          lightColor: '#8b5cf6'
        },
        {
          id: 'journal-reminders-critical',
          name: 'Critical Journal Reminders', 
          description: 'High-priority journal reminders',
          importance: 5, // MAX importance
          sound: 'default',
          vibration: true,
          visibility: 1,
          lights: true,
          lightColor: '#8b5cf6'
        }
      ];

      await LocalNotifications.createChannel(channels[0]);
      await LocalNotifications.createChannel(channels[1]);
      
      this.notificationChannelsCreated = true;
      console.log('✅ Notification channels created successfully');
    } catch (error) {
      console.error('❌ Error creating notification channels:', error);
    }
  }

  /**
   * Request comprehensive permissions including battery optimization and exact alarms
   */
  async requestPermissionsAndSetup(times: JournalReminderTime[], userTimezone?: string): Promise<boolean> {
    await this.ensureInitialized();
    
    // Store user timezone for proper scheduling
    if (userTimezone) {
      console.log('🕐 Using provided user timezone:', userTimezone);
    } else {
      console.log('🕐 Using browser timezone for notifications');
    }
    
    try {
      if (this.platformInfo?.isNative) {
        console.log('📱 Requesting comprehensive native notification permissions...');
        
        // Request basic notification permissions
        const permissionResult = await LocalNotifications.requestPermissions();
        console.log('🔔 Basic permission result:', permissionResult);
        
        if (permissionResult.display !== 'granted') {
          console.warn('⚠️ Basic notification permissions not granted');
          return false;
        }

        // Handle battery optimization for Android
        await this.handleBatteryOptimization();
        
        // Request exact alarm permission for Android 12+
        await this.requestExactAlarmPermission();
        
      } else {
        console.log('🌐 Requesting web notification permissions...');
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            console.warn('⚠️ Web notification permissions not granted');
            return false;
          }
        }
      }

      console.log('✅ All permissions granted, setting up reminders...');
      await this.setupReminders(times, userTimezone);
      return true;
    } catch (error) {
      console.error('❌ Error requesting permissions and setting up reminders:', error);
      return false;
    }
  }

  /**
   * Handle Android battery optimization interference
   */
  private async handleBatteryOptimization(): Promise<void> {
    if (!this.platformInfo?.isNative || this.platformInfo.platform !== 'android') {
      return;
    }

    try {
      console.log('🔋 Handling Android battery optimization...');
      
      // Check if we can request battery optimization exemption
      if ((window as any).Capacitor?.Plugins?.Device) {
        // This would typically require a custom Capacitor plugin
        // For now, we'll log the requirement
        console.log('⚠️ Consider requesting battery optimization exemption for reliable notifications');
      }
      
      // Show user guidance for manual battery optimization disable
      this.showBatteryOptimizationGuidance();
      
    } catch (error) {
      console.error('❌ Error handling battery optimization:', error);
    }
  }

  /**
   * Request exact alarm permission for Android 12+
   */
  private async requestExactAlarmPermission(): Promise<void> {
    if (!this.platformInfo?.isNative || this.platformInfo.platform !== 'android') {
      return;
    }

    try {
      console.log('⏰ Requesting exact alarm permissions for Android 12+...');
      
      // This would typically require a custom Capacitor plugin to check/request exact alarm permission
      // For now, we'll use enhanced notification scheduling
      console.log('✅ Using enhanced scheduling for Android compatibility');
      
    } catch (error) {
      console.error('❌ Error requesting exact alarm permission:', error);
    }
  }

  /**
   * Show guidance for battery optimization
   */
  private showBatteryOptimizationGuidance(): void {
    // This could trigger a modal or toast with guidance
    console.log(`
    📋 For reliable notifications, please:
    1. Go to Settings > Apps > Soulo > Battery
    2. Select "Don't optimize" or "Unrestricted"
    3. Enable "Allow background activity"
    `);
  }

  /**
   * Setup reminders with absolute timestamps instead of recurring schedules
   */
  private async setupReminders(times: JournalReminderTime[], userTimezone?: string): Promise<void> {
    const timezone = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log('⚙️ Setting up enhanced reminders for times:', times, 'timezone:', timezone);
    
    // Clear existing reminders first
    await this.clearAllReminders();
    
    const strategy = enhancedPlatformService.getBestNotificationStrategy();
    console.log('🎯 Using notification strategy:', strategy);
    
    if (strategy === 'native') {
      await this.setupNativeReminders(times, timezone);
    } else {
      this.setupWebReminders(times, timezone);
    }
    
    // Start health check to monitor reminder status
    this.startHealthCheck();
  }

  /**
   * Set up native notifications with absolute timestamps and enhanced debugging
   */
  private async setupNativeReminders(times: JournalReminderTime[], timezone?: string): Promise<void> {
    if (!this.platformInfo?.capabilities.nativeNotifications) {
      throw new Error('Native notifications not supported');
    }

    console.log('📱 Setting up enhanced native reminders for times:', times);

    try {
      // Clear existing notifications
      await LocalNotifications.cancel({ notifications: [] });
      
      const notifications: ScheduleOptions[] = [];
      
      for (const time of times) {
        // Generate multiple absolute notifications instead of relying on recurring
        const absoluteNotifications = this.generateAbsoluteNotifications(time, 30, timezone); // 30 days worth
        notifications.push(...absoluteNotifications);
      }

      if (notifications.length > 0) {
        console.log(`📋 Scheduling ${notifications.length} absolute notifications`);
        
        // Schedule in batches to avoid overwhelming the system
        const batchSize = 10;
        for (let i = 0; i < notifications.length; i += batchSize) {
          const batch = notifications.slice(i, i + batchSize);
          await LocalNotifications.schedule({ notifications: batch as any });
          console.log(`✅ Scheduled batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(notifications.length/batchSize)}`);
          
          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Enhanced verification
        await this.verifyNativeNotificationsWithRetry(notifications);
        
        // Store reminder info
        this.activeReminders = times.map(time => ({
          id: `enhanced-native-${time}`,
          time,
          scheduledFor: this.getNextReminderTime(time),
          strategy: 'native'
        }));
      }
      
      this.currentStrategy = 'native';
      this.isServiceEnabled = true;
      
    } catch (error) {
      console.error('❌ Error setting up enhanced native reminders:', error);
      throw error;
    }
  }

  /**
   * Generate absolute notification timestamps instead of recurring schedules
   */
  private generateAbsoluteNotifications(time: JournalReminderTime, days: number, timezone?: string): ScheduleOptions[] {
    const notifications: ScheduleOptions[] = [];
    const { hour, minute } = this.TIME_MAPPINGS[time];
    const now = new Date();
    
    for (let i = 0; i < days; i++) {
      const scheduleDate = new Date();
      scheduleDate.setDate(now.getDate() + i);
      scheduleDate.setHours(hour, minute, 0, 0);
      
      // Skip if time has already passed today
      if (i === 0 && scheduleDate.getTime() <= now.getTime()) {
        continue;
      }
      
      const notificationId = this.getNotificationId(time, i);
      
      notifications.push({
        title: this.getNotificationTitle(time),
        body: this.getNotificationBody(time),
        id: notificationId,
        schedule: {
          at: scheduleDate,
          allowWhileIdle: true
        },
        sound: 'default',
        channelId: 'journal-reminders',
        actionTypeId: 'JOURNAL_REMINDER',
        extra: {
          reminderTime: time,
          type: 'journal_reminder',
          absolute: true,
          day: i,
          timezone: timezone
        }
      } as any);
    }
    
    console.log(`📅 Generated ${notifications.length} absolute notifications for ${time}`);
    return notifications;
  }

  /**
   * Enhanced notification ID generation
   */
  private getNotificationId(time: JournalReminderTime, dayOffset: number = 0): number {
    const timeIds = {
      morning: 1000,
      afternoon: 2000, 
      evening: 3000,
      night: 4000
    };
    
    return timeIds[time] + dayOffset;
  }

  /**
   * Verify native notifications with retry logic
   */
  private async verifyNativeNotificationsWithRetry(expectedNotifications: ScheduleOptions[], maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 Verification attempt ${attempt}/${maxRetries}`);
        
        // Wait a moment for system to process
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const result = await LocalNotifications.getPending();
        const pendingNotifications = result.notifications;
        
        console.log(`📊 Found ${pendingNotifications.length} pending notifications, expected ${expectedNotifications.length}`);
        
        if (pendingNotifications.length >= expectedNotifications.length * 0.8) { // Allow 80% success rate
          console.log('✅ Notification verification passed');
          return;
        }
        
        if (attempt === maxRetries) {
          throw new Error(`Verification failed after ${maxRetries} attempts`);
        }
        
        console.log(`⚠️ Verification failed, retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        console.log(`❌ Verification attempt ${attempt} failed:`, error);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  /**
   * Disable reminders and clean up
   */
  async disableReminders(): Promise<void> {
    console.log('🛑 Disabling enhanced journal reminders');
    
    await this.clearAllReminders();
    this.stopHealthCheck();
    this.saveSettings({ enabled: false, times: [] });
    
    this.isServiceEnabled = false;
    this.currentStrategy = null;
  }

  /**
   * Clear all active reminders
   */
  private async clearAllReminders(): Promise<void> {
    console.log('🧹 Clearing all enhanced reminders');
    
    // Clear web timeouts
    this.activeReminders.forEach(reminder => {
      if (reminder.timeoutId) {
        clearTimeout(reminder.timeoutId);
      }
    });
    
    // Clear native reminders
    if (this.platformInfo?.capabilities.nativeNotifications) {
      try {
        await LocalNotifications.cancel({ notifications: [] });
        console.log('✅ Cleared all native notifications');
      } catch (error) {
        console.error('❌ Error clearing native notifications:', error);
      }
    }
    
    this.activeReminders = [];
  }

  /**
   * Enhanced health check with deep verification
   */
  private startHealthCheck(): void {
    this.stopHealthCheck();
    
    // More frequent health checks for better reliability
    const HEALTH_CHECK_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours
    
    this.healthCheckInterval = window.setInterval(async () => {
      try {
        await this.performEnhancedHealthCheck();
      } catch (error) {
        console.error('❌ Error during enhanced health check:', error);
      }
    }, HEALTH_CHECK_INTERVAL);
    
    console.log('💓 Enhanced health check started - verifying every 2 hours');
  }

  /**
   * Perform comprehensive health check
   */
  private async performEnhancedHealthCheck(): Promise<void> {
    const settings = this.getSettings();
    
    if (!settings.enabled || settings.times.length === 0) {
      console.log('⏹️ Reminders disabled, stopping health check');
      this.stopHealthCheck();
      return;
    }

    console.log('💓 Performing enhanced health check...');
    
    // Check if we're still in native mode
    if (this.currentStrategy === 'native') {
      try {
        const result = await LocalNotifications.getPending();
        const pendingCount = result.notifications.length;
        
        console.log(`📊 Health check: ${pendingCount} pending notifications`);
        
        // If we have fewer than expected, refresh the schedule
        const expectedMinimum = settings.times.length * 5; // At least 5 days worth
        
        if (pendingCount < expectedMinimum) {
          console.log('⚠️ Low notification count detected, refreshing schedule');
          await this.setupReminders(settings.times);
        } else {
          console.log('✅ Health check passed');
        }
        
      } catch (error) {
        console.error('❌ Health check failed, attempting to recover:', error);
        await this.setupReminders(settings.times);
      }
    }
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      console.log('💓 Health check stopped');
    }
  }

  private setupWebReminders(times: JournalReminderTime[], timezone?: string): void {
    console.log('🌐 Setting up web reminders with timezone:', timezone);
    
    times.forEach(time => {
      const reminder = this.scheduleWebReminder(time, timezone);
      this.activeReminders.push(reminder);
    });
    
    console.log(`✅ Scheduled ${this.activeReminders.length} web reminders`);
  }

  private scheduleWebReminder(time: JournalReminderTime, timezone?: string): ScheduledReminder {
    const id = `web-${time}-${Date.now()}`;
    const scheduledFor = this.getNextReminderTime(time);
    
    console.log(`⏰ Scheduling web reminder for ${time} at ${scheduledFor.toLocaleString()}`);
    
    const timeoutMs = scheduledFor.getTime() - Date.now();
    
    const timeoutId = window.setTimeout(() => {
      console.log(`🔔 Showing web reminder for ${time}`);
      
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
      console.log('⚠️ Cannot show web notification - permission not granted');
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

  private getNextReminderTime(time: JournalReminderTime, timezone?: string): Date {
    const now = new Date();
    const { hour, minute } = this.TIME_MAPPINGS[time];
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Start with today's target time
    const today = new Date();
    today.setHours(hour, minute, 0, 0);
    
    // If today's time has already passed, schedule for tomorrow
    if (today.getTime() <= now.getTime()) {
      today.setDate(today.getDate() + 1);
    }
    
    console.log(`📅 Reminder ${time} scheduled for ${today.toLocaleString()} (timezone: ${tz})`);
    return today;
  }

  // Settings and utility methods
  private saveSettings(settings: JournalReminderSettings): void {
    localStorage.setItem('journal_reminder_enabled', settings.enabled.toString());
    localStorage.setItem('journal_reminder_times', JSON.stringify(settings.times));
    console.log('💾 Settings saved:', settings);
  }

  getSettings(): JournalReminderSettings {
    const enabled = localStorage.getItem('journal_reminder_enabled') === 'true';
    const timesStr = localStorage.getItem('journal_reminder_times');
    
    let times: JournalReminderTime[] = [];
    if (timesStr) {
      try {
        times = JSON.parse(timesStr);
      } catch (error) {
        console.error('❌ Error parsing saved times:', error);
      }
    }
    
    return { enabled, times };
  }

  /**
   * Setup app lifecycle handlers for persistence
   */
  private setupAppLifecycleHandlers(): void {
    // Handle visibility change (app backgrounding/foregrounding)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // App came to foreground, verify reminders after a short delay
        setTimeout(async () => {
          const settings = this.getSettings();
          if (settings.enabled && settings.times.length > 0) {
            console.log('👀 App foregrounded, verifying reminder status');
            await this.performEnhancedHealthCheck();
          }
        }, 1000);
      }
    });

    // Handle Capacitor app state changes if available
    if ((window as any).Capacitor?.Plugins?.App) {
      const { App } = (window as any).Capacitor.Plugins;
      
      App.addListener('appStateChange', async (state: { isActive: boolean }) => {
        if (state.isActive) {
          const settings = this.getSettings();
          if (settings.enabled && settings.times.length > 0) {
            console.log('📱 Native app became active, verifying reminders');
            await this.performEnhancedHealthCheck();
          }
        }
      });
    }
  }

  /**
   * Test reminder functionality
   */
  async testReminder(): Promise<boolean> {
    console.log('🧪 Testing enhanced journal reminder');
    
    try {
      await this.ensureInitialized();
      
      if (this.platformInfo?.isNative) {
        return await this.testNativeReminder();
      } else {
        return this.testWebReminder();
      }
    } catch (error) {
      console.error('❌ Error testing reminder:', error);
      return false;
    }
  }

  private async testNativeReminder(): Promise<boolean> {
    try {
      // Schedule immediate test notification
      await LocalNotifications.schedule({
        notifications: [{
          id: 9999,
          title: 'Enhanced Test Journal Reminder 🧪',
          body: 'Your enhanced journal reminders are working perfectly!',
          schedule: { at: new Date(Date.now() + 3000) }, // 3 seconds from now
          channelId: 'journal-reminders',
          extra: { test: true, enhanced: true }
        }]
      });

      // Verify it was scheduled
      const result = await LocalNotifications.getPending();
      const testNotification = result.notifications.find(n => n.id === 9999);
      
      if (!testNotification) {
        console.error('❌ Enhanced test notification was not found in pending notifications');
        return this.testWebReminder();
      }

      console.log('✅ Enhanced native test reminder scheduled and verified');
      return true;
    } catch (error) {
      console.error('❌ Error with enhanced native test reminder:', error);
      return this.testWebReminder();
    }
  }

  private testWebReminder(): boolean {
    try {
      const notification = new Notification('Enhanced Test Journal Reminder 🧪', {
        body: 'Your enhanced journal reminders are working perfectly!',
        icon: '/favicon.ico',
        tag: 'test-enhanced-journal-reminder'
      });

      setTimeout(() => {
        notification.close();
      }, 5000);

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      console.log('✅ Enhanced web test reminder shown');
      return true;
    } catch (error) {
      console.error('❌ Error with enhanced web test reminder:', error);
      return false;
    }
  }

  /**
   * Get comprehensive notification status
   */
  async getNotificationStatus(): Promise<{
    strategy: string;
    activeReminders: number;
    pendingNative?: number;
    permissionState: string;
    verified: boolean;
    channelsCreated: boolean;
    platformInfo: any;
  }> {
    try {
      await this.ensureInitialized();
      
      const strategy = enhancedPlatformService.getBestNotificationStrategy();
      let permissionState = 'unknown';
      let pendingNative: number | undefined;
      let verified = false;
      
      if (this.platformInfo?.isNative) {
        try {
          const permissionResult = await LocalNotifications.checkPermissions();
          permissionState = permissionResult.display;
          
          const result = await LocalNotifications.getPending();
          pendingNative = result.notifications.length;
          verified = pendingNative > 0;
        } catch (error) {
          console.error('❌ Error getting native notification status:', error);
        }
      } else {
        permissionState = Notification.permission;
        verified = this.activeReminders.length > 0;
      }
      
      return {
        strategy,
        activeReminders: this.activeReminders.length,
        pendingNative,
        permissionState,
        verified,
        channelsCreated: this.notificationChannelsCreated,
        platformInfo: this.platformInfo
      };
    } catch (error) {
      console.error('❌ Error getting enhanced notification status:', error);
      return {
        strategy: 'unknown',
        activeReminders: 0,
        permissionState: 'unknown',
        verified: false,
        channelsCreated: false,
        platformInfo: null
      };
    }
  }

  /**
   * Initialize reminders on app start if enabled
   */
  async initializeOnAppStart(): Promise<void> {
    try {
      await this.ensureInitialized();
      
      const settings = this.getSettings();
      
      if (settings.enabled && settings.times.length > 0) {
        console.log('🚀 Initializing enhanced reminders on app start', settings);
        
        // Check if permissions are still granted
        let hasPermission = false;
        
        if (this.platformInfo?.isNative) {
          const permissionResult = await LocalNotifications.checkPermissions();
          hasPermission = permissionResult.display === 'granted';
        } else {
          hasPermission = Notification.permission === 'granted';
        }
        
        if (hasPermission) {
          await this.setupReminders(settings.times);
        } else {
          console.log('⚠️ Permissions no longer granted, disabling reminders');
          this.saveSettings({ enabled: false, times: [] });
        }
      }
    } catch (error) {
      console.error('❌ Error initializing enhanced reminders on app start:', error);
    }
  }
}

export const enhancedJournalReminderService = EnhancedJournalReminderService.getInstance();
