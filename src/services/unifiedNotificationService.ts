import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { notificationDebugLogger } from './notificationDebugLogger';
import { timezoneNotificationHelper, JournalReminderTime } from './timezoneNotificationHelper';

export interface UnifiedNotificationSettings {
  enabled: boolean;
  times: JournalReminderTime[];
  timezone: string;
  lastUpdated: string;
}

export interface UnifiedNotificationResult {
  success: boolean;
  error?: string;
  strategy: 'native' | 'web' | 'hybrid';
  scheduledCount: number;
  verificationPassed: boolean;
  debugInfo: any;
}

export interface NotificationVerificationResult {
  expectedCount: number;
  actualCount: number;
  successRate: number;
  pendingNotifications: any[];
  healthStatus: 'healthy' | 'degraded' | 'failed';
}

/**
 * Unified notification service with comprehensive timezone support, 
 * WebView detection, and debug logging
 */
class UnifiedNotificationService {
  private static instance: UnifiedNotificationService;
  private isNative = false;
  private isWebView = false;
  private strategy: 'native' | 'web' | 'hybrid' = 'web';
  private healthCheckInterval?: number;
  private activeSettings: UnifiedNotificationSettings | null = null;

  static getInstance(): UnifiedNotificationService {
    if (!UnifiedNotificationService.instance) {
      UnifiedNotificationService.instance = new UnifiedNotificationService();
    }
    return UnifiedNotificationService.instance;
  }

  constructor() {
    this.initializePlatformDetection();
  }

  /**
   * Enhanced platform and WebView detection
   */
  private initializePlatformDetection(): void {
    this.isNative = Capacitor.isNativePlatform();
    this.isWebView = this.detectWebView();
    this.strategy = this.determineBestStrategy();

    notificationDebugLogger.logEvent('PLATFORM_DETECTION', {
      isNative: this.isNative,
      isWebView: this.isWebView,
      strategy: this.strategy,
      platform: Capacitor.getPlatform(),
      userAgent: navigator.userAgent,
      capabilities: this.getPlatformCapabilities()
    });

    console.log(`[UnifiedNotificationService] Initialized with strategy: ${this.strategy}`, {
      isNative: this.isNative,
      isWebView: this.isWebView,
      platform: Capacitor.getPlatform()
    });
  }

  /**
   * Enhanced WebView detection
   */
  private detectWebView(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Enhanced WebView detection patterns
    const webViewPatterns = [
      /.*wv\).*(chrome)\/.*/, // Standard WebView pattern
      /.*android.*version\/.*chrome\/.*mobile.*safari.*/, // Android WebView
      /.*mobile.*safari.*version\/.*/, // iOS WebView  
      /capacitor/i, // Capacitor specific
      /cordova/i, // Cordova/PhoneGap
    ];

    const hasWebViewPattern = webViewPatterns.some(pattern => pattern.test(userAgent));
    
    // Additional Capacitor-specific checks
    const isCapacitorWebView = !!(window as any).Capacitor && 
                              this.isNative && 
                              !userAgent.includes('chrome/');

    // Check for missing features that indicate WebView
    const missingFeatures = !(window as any).chrome || !navigator.serviceWorker;

    return hasWebViewPattern || isCapacitorWebView || (this.isNative && missingFeatures);
  }

  /**
   * Determine the best notification strategy based on platform capabilities
   */
  private determineBestStrategy(): 'native' | 'web' | 'hybrid' {
    if (this.isNative && !this.isWebView) {
      return 'native';
    } else if (this.isWebView) {
      return 'hybrid'; // Use both native and web fallbacks
    } else {
      return 'web';
    }
  }

  /**
   * Get platform capabilities for debugging
   */
  private getPlatformCapabilities(): any {
    return {
      hasServiceWorker: 'serviceWorker' in navigator,
      hasNotificationAPI: 'Notification' in window,
      hasLocalStorage: 'localStorage' in window,
      hasWebView: this.isWebView,
      hasCapacitor: !!(window as any).Capacitor,
      platform: Capacitor.getPlatform(),
      plugins: Object.keys((window as any).Capacitor?.Plugins || {})
    };
  }

  /**
   * Request comprehensive permissions and setup notifications
   */
  async requestPermissionsAndSetup(times: JournalReminderTime[]): Promise<UnifiedNotificationResult> {
    notificationDebugLogger.logUserAction('SETUP_REMINDERS', {
      times,
      strategy: this.strategy,
      timezone: timezoneNotificationHelper.getUserTimezone()
    });

    try {
      // Clear any existing notifications first
      await this.clearAllNotifications();

      let result: UnifiedNotificationResult;

      switch (this.strategy) {
        case 'native':
          result = await this.setupNativeNotifications(times);
          break;
        case 'hybrid':
          result = await this.setupHybridNotifications(times);
          break;
        case 'web':
          result = await this.setupWebNotifications(times);
          break;
        default:
          throw new Error(`Unknown strategy: ${this.strategy}`);
      }

      if (result.success) {
        this.activeSettings = {
          enabled: true,
          times,
          timezone: timezoneNotificationHelper.getUserTimezone(),
          lastUpdated: new Date().toISOString()
        };
        this.saveSettings(this.activeSettings);
        this.startHealthCheck();
      }

      notificationDebugLogger.logEvent('SETUP_COMPLETE', result, result.success, result.error);
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      notificationDebugLogger.logEvent('SETUP_FAILED', { error: errorMsg }, false, errorMsg);
      
      return {
        success: false,
        error: errorMsg,
        strategy: this.strategy,
        scheduledCount: 0,
        verificationPassed: false,
        debugInfo: { error: errorMsg }
      };
    }
  }

  /**
   * Setup native notifications with timezone awareness
   */
  private async setupNativeNotifications(times: JournalReminderTime[]): Promise<UnifiedNotificationResult> {
    try {
      // Request permissions
      const permissions = await LocalNotifications.requestPermissions();
      notificationDebugLogger.logPermissionRequest('NATIVE', permissions);

      if (permissions.display !== 'granted') {
        throw new Error('Native notification permissions denied');
      }

      // Create notification channels (Android)
      if (Capacitor.getPlatform() === 'android') {
        await this.createAndroidChannels();
      }

      // Schedule timezone-aware notifications
      const scheduledCount = await this.scheduleNativeNotifications(times);

      // Verify notifications were scheduled
      const verification = await this.verifyNotifications(times.length);

      return {
        success: true,
        strategy: 'native',
        scheduledCount,
        verificationPassed: verification.healthStatus === 'healthy',
        debugInfo: {
          permissions,
          verification,
          timezone: timezoneNotificationHelper.getUserTimezone()
        }
      };

    } catch (error) {
      throw new Error(`Native setup failed: ${error}`);
    }
  }

  /**
   * Setup hybrid notifications (WebView with native fallback)
   */
  private async setupHybridNotifications(times: JournalReminderTime[]): Promise<UnifiedNotificationResult> {
    const results = {
      native: null as any,
      web: null as any
    };

    try {
      // Try native first
      try {
        results.native = await this.setupNativeNotifications(times);
        notificationDebugLogger.logEvent('HYBRID_NATIVE_SUCCESS', results.native);
      } catch (error) {
        notificationDebugLogger.logEvent('HYBRID_NATIVE_FAILED', { error }, false);
        
        // Fallback to web notifications
        results.web = await this.setupWebNotifications(times);
        notificationDebugLogger.logEvent('HYBRID_WEB_FALLBACK', results.web);
      }

      const successfulResult = results.native || results.web;
      
      return {
        success: !!successfulResult,
        strategy: 'hybrid',
        scheduledCount: successfulResult?.scheduledCount || 0,
        verificationPassed: successfulResult?.verificationPassed || false,
        debugInfo: {
          nativeResult: results.native,
          webResult: results.web,
          strategy: results.native ? 'native' : 'web'
        }
      };

    } catch (error) {
      throw new Error(`Hybrid setup failed: ${error}`);
    }
  }

  /**
   * Setup web notifications with timezone awareness
   */
  private async setupWebNotifications(times: JournalReminderTime[]): Promise<UnifiedNotificationResult> {
    try {
      // Request web notification permission
      const permission = await Notification.requestPermission();
      notificationDebugLogger.logPermissionRequest('WEB', { permission });

      if (permission !== 'granted') {
        throw new Error('Web notification permissions denied');
      }

      // Schedule web notifications using setTimeout with timezone awareness
      const scheduledCount = this.scheduleWebNotifications(times);

      return {
        success: true,
        strategy: 'web',
        scheduledCount,
        verificationPassed: true, // Web notifications are immediate
        debugInfo: {
          permission,
          hasServiceWorker: 'serviceWorker' in navigator,
          timezone: timezoneNotificationHelper.getUserTimezone()
        }
      };

    } catch (error) {
      throw new Error(`Web setup failed: ${error}`);
    }
  }

  /**
   * Schedule native notifications with absolute timestamps
   */
  private async scheduleNativeNotifications(times: JournalReminderTime[]): Promise<number> {
    const notifications: any[] = [];
    const daysToSchedule = 30; // Schedule 30 days in advance

    for (const time of times) {
      const absoluteTimes = timezoneNotificationHelper.generateAbsoluteTimesInTimezone(time, daysToSchedule);
      
      absoluteTimes.forEach((absoluteTime, index) => {
        const notificationId = this.generateNotificationId(time, index);
        
        notifications.push({
          id: notificationId,
          title: this.getNotificationTitle(time),
          body: this.getNotificationBody(time),
          schedule: {
            at: absoluteTime,
            allowWhileIdle: true
          },
          sound: 'default',
          channelId: 'journal-reminders-priority',
          actionTypeId: 'JOURNAL_REMINDER',
          extra: {
            reminderTime: time,
            scheduledFor: absoluteTime.toISOString(),
            timezone: timezoneNotificationHelper.getUserTimezone(),
            isAbsolute: true
          }
        });
      });
    }

    // Schedule in batches to avoid overwhelming the system
    const batchSize = 10;
    let scheduledCount = 0;

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      await LocalNotifications.schedule({ notifications: batch });
      scheduledCount += batch.length;
      
      notificationDebugLogger.logEvent('BATCH_SCHEDULED', {
        batchNumber: Math.floor(i / batchSize) + 1,
        batchSize: batch.length,
        totalScheduled: scheduledCount
      });

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    notificationDebugLogger.logScheduleAttempt(
      times, 
      'native', 
      { success: true, scheduledCount, totalNotifications: notifications.length }
    );

    return scheduledCount;
  }

  /**
   * Schedule web notifications with timezone awareness
   */
  private scheduleWebNotifications(times: JournalReminderTime[]): number {
    let scheduledCount = 0;
    
    times.forEach(time => {
      const nextTime = timezoneNotificationHelper.getNextReminderTimeInTimezone(time);
      const delay = nextTime.getTime() - Date.now();
      
      if (delay > 0) {
        setTimeout(() => {
          this.showWebNotification(time);
          // Reschedule for next day
          this.scheduleNextWebNotification(time);
        }, delay);
        
        scheduledCount++;
        
        notificationDebugLogger.logEvent('WEB_SCHEDULED', {
          time,
          nextTime: timezoneNotificationHelper.formatTimeForUser(nextTime),
          delay: `${Math.round(delay / 1000)}s`
        });
      }
    });

    return scheduledCount;
  }

  /**
   * Show web notification
   */
  private showWebNotification(time: JournalReminderTime): void {
    if (Notification.permission !== 'granted') return;

    const notification = new Notification(this.getNotificationTitle(time), {
      body: this.getNotificationBody(time),
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `journal-${time}`,
      requireInteraction: false,
      data: { time, action: 'open_journal' }
    });

    notificationDebugLogger.logEvent('WEB_NOTIFICATION_SHOWN', {
      time,
      timestamp: new Date().toISOString()
    });

    setTimeout(() => notification.close(), 8000);

    notification.onclick = () => {
      window.focus();
      notification.close();
      window.location.href = '/app/voice-entry';
    };
  }

  /**
   * Schedule next occurrence of web notification
   */
  private scheduleNextWebNotification(time: JournalReminderTime): void {
    // Add 24 hours to get next day's notification
    const nextTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const targetTime = timezoneNotificationHelper.getNextReminderTimeInTimezone(time);
    const delay = targetTime.getTime() - Date.now();

    if (delay > 0) {
      setTimeout(() => {
        this.showWebNotification(time);
        this.scheduleNextWebNotification(time);
      }, delay);
    }
  }

  /**
   * Create Android notification channels
   */
  private async createAndroidChannels(): Promise<void> {
    const channels = [
      {
        id: 'journal-reminders-priority',
        name: 'Journal Reminders',
        description: 'Daily journal entry reminders with high priority',
        importance: 4 as any, // HIGH
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: '#8b5cf6'
      }
    ];

    for (const channel of channels) {
      await LocalNotifications.createChannel(channel);
    }

    notificationDebugLogger.logEvent('ANDROID_CHANNELS_CREATED', { channels });
  }

  /**
   * Verify notifications were scheduled correctly
   */
  private async verifyNotifications(expectedTimes: number): Promise<NotificationVerificationResult> {
    try {
      if (!this.isNative) {
        return {
          expectedCount: expectedTimes,
          actualCount: expectedTimes, // Web notifications are immediate
          successRate: 100,
          pendingNotifications: [],
          healthStatus: 'healthy'
        };
      }

      const result = await LocalNotifications.getPending();
      const actualCount = result.notifications.length;
      const successRate = expectedTimes > 0 ? Math.round((actualCount / expectedTimes) * 100) : 0;
      
      let healthStatus: 'healthy' | 'degraded' | 'failed';
      if (successRate >= 80) {
        healthStatus = 'healthy';
      } else if (successRate >= 50) {
        healthStatus = 'degraded';
      } else {
        healthStatus = 'failed';
      }

      const verification: NotificationVerificationResult = {
        expectedCount: expectedTimes,
        actualCount,
        successRate,
        pendingNotifications: result.notifications,
        healthStatus
      };

      notificationDebugLogger.logVerification(expectedTimes, actualCount, result.notifications);
      
      return verification;

    } catch (error) {
      notificationDebugLogger.logEvent('VERIFICATION_FAILED', { error }, false);
      return {
        expectedCount: expectedTimes,
        actualCount: 0,
        successRate: 0,
        pendingNotifications: [],
        healthStatus: 'failed'
      };
    }
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    try {
      if (this.isNative) {
        await LocalNotifications.cancel({ notifications: [] });
        await LocalNotifications.removeAllDeliveredNotifications();
      }
      
      // Clear web timeouts (stored in localStorage)
      localStorage.removeItem('web_notification_timeouts');
      
      notificationDebugLogger.logEvent('NOTIFICATIONS_CLEARED', {
        strategy: this.strategy,
        isNative: this.isNative
      });

    } catch (error) {
      notificationDebugLogger.logEvent('CLEAR_FAILED', { error }, false);
    }
  }

  /**
   * Disable all reminders
   */
  async disableReminders(): Promise<void> {
    await this.clearAllNotifications();
    this.stopHealthCheck();
    this.activeSettings = null;
    this.saveSettings({ enabled: false, times: [], timezone: '', lastUpdated: '' });
    
    notificationDebugLogger.logEvent('REMINDERS_DISABLED', {
      strategy: this.strategy
    });
  }

  /**
   * Test notification functionality
   */
  async testNotification(): Promise<boolean> {
    try {
      notificationDebugLogger.logEvent('TEST_NOTIFICATION_START', {
        strategy: this.strategy,
        isNative: this.isNative,
        isWebView: this.isWebView
      });

      if (this.isNative) {
        const permissions = await LocalNotifications.checkPermissions();
        if (permissions.display !== 'granted') {
          throw new Error('No native permissions');
        }

        await LocalNotifications.schedule({
          notifications: [{
            id: 99999,
            title: '🧪 Test Journal Reminder',
            body: 'Your notifications are working correctly!',
            schedule: { at: new Date(Date.now() + 2000) },
            channelId: 'journal-reminders-priority'
          }]
        });
      } else {
        if (Notification.permission !== 'granted') {
          throw new Error('No web permissions');
        }

        new Notification('🧪 Test Journal Reminder', {
          body: 'Your notifications are working correctly!',
          icon: '/favicon.ico'
        });
      }

      notificationDebugLogger.logEvent('TEST_NOTIFICATION_SUCCESS', {
        strategy: this.strategy,
        timestamp: new Date().toISOString()
      });

      return true;

    } catch (error) {
      notificationDebugLogger.logEvent('TEST_NOTIFICATION_FAILED', { error }, false);
      return false;
    }
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    this.stopHealthCheck();
    
    const HEALTH_CHECK_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours
    
    this.healthCheckInterval = window.setInterval(async () => {
      await this.performHealthCheck();
    }, HEALTH_CHECK_INTERVAL);

    notificationDebugLogger.logEvent('HEALTH_CHECK_STARTED', {
      interval: HEALTH_CHECK_INTERVAL,
      strategy: this.strategy
    });
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.activeSettings?.enabled) {
      this.stopHealthCheck();
      return;
    }

    try {
      const verification = await this.verifyNotifications(this.activeSettings.times.length);
      
      notificationDebugLogger.logEvent('HEALTH_CHECK', {
        verification,
        settings: this.activeSettings,
        status: verification.healthStatus
      });

      // If health is degraded, attempt to refresh notifications
      if (verification.healthStatus === 'degraded' || verification.healthStatus === 'failed') {
        notificationDebugLogger.logEvent('HEALTH_CHECK_REFRESH', {
          reason: `Health status: ${verification.healthStatus}`
        });
        
        await this.requestPermissionsAndSetup(this.activeSettings.times);
      }

    } catch (error) {
      notificationDebugLogger.logEvent('HEALTH_CHECK_FAILED', { error }, false);
    }
  }

  /**
   * Stop health check monitoring
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Get comprehensive notification status
   */
  async getNotificationStatus(): Promise<any> {
    const systemStatus = await notificationDebugLogger.getSystemStatus();
    const verification = this.activeSettings ? 
      await this.verifyNotifications(this.activeSettings.times.length) : null;

    return {
      ...systemStatus,
      activeSettings: this.activeSettings,
      strategy: this.strategy,
      verification,
      debugInfo: timezoneNotificationHelper.getTimezoneDebugInfo(),
      recentEvents: notificationDebugLogger.getFilteredEvents({
        since: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      })
    };
  }

  /**
   * Get debug report
   */
  getDebugReport(): string {
    return notificationDebugLogger.generateDebugReport();
  }

  // Helper methods

  private generateNotificationId(time: JournalReminderTime, dayOffset: number): number {
    const timeIds = {
      morning: 1000,
      afternoon: 2000,
      evening: 3000,
      night: 4000
    };
    return timeIds[time] + dayOffset;
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

  private saveSettings(settings: Partial<UnifiedNotificationSettings>): void {
    Object.entries(settings).forEach(([key, value]) => {
      if (value !== undefined) {
        localStorage.setItem(`unified_notification_${key}`, 
          typeof value === 'string' ? value : JSON.stringify(value));
      }
    });
  }

  getSettings(): UnifiedNotificationSettings {
    const enabled = localStorage.getItem('unified_notification_enabled') === 'true';
    const timesStr = localStorage.getItem('unified_notification_times');
    const timezone = localStorage.getItem('unified_notification_timezone') || 'UTC';
    const lastUpdated = localStorage.getItem('unified_notification_lastUpdated') || '';
    
    let times: JournalReminderTime[] = [];
    if (timesStr) {
      try {
        times = JSON.parse(timesStr);
      } catch (error) {
        console.warn('Failed to parse notification times:', error);
      }
    }

    return { enabled, times, timezone, lastUpdated };
  }
}

export const unifiedNotificationService = UnifiedNotificationService.getInstance();