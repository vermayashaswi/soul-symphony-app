import { formatInTimeZone } from 'date-fns-tz';

export interface NotificationDebugEvent {
  id: string;
  timestamp: Date;
  event: string;
  data: any;
  success: boolean;
  error?: string;
  platform: string;
  timezone: string;
  userAgent: string;
}

export interface NotificationSystemStatus {
  isWebView: boolean;
  isNative: boolean;
  platform: string;
  permissions: any;
  timezone: string;
  scheduledCount: number;
  lastError?: string;
  batteryOptimized?: boolean;
  doNotDisturb?: string;
}

class NotificationDebugLogger {
  private static instance: NotificationDebugLogger;
  private events: NotificationDebugEvent[] = [];
  private readonly MAX_EVENTS = 100;
  private readonly STORAGE_KEY = 'notification_debug_logs';

  static getInstance(): NotificationDebugLogger {
    if (!NotificationDebugLogger.instance) {
      NotificationDebugLogger.instance = new NotificationDebugLogger();
    }
    return NotificationDebugLogger.instance;
  }

  constructor() {
    this.loadStoredEvents();
  }

  /**
   * Log a notification debug event
   */
  logEvent(event: string, data: any, success: boolean = true, error?: string): void {
    const debugEvent: NotificationDebugEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      event,
      data: this.sanitizeData(data),
      success,
      error,
      platform: this.detectPlatform(),
      timezone: this.getUserTimezone(),
      userAgent: navigator.userAgent
    };

    this.events.unshift(debugEvent);
    
    // Keep only recent events
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(0, this.MAX_EVENTS);
    }

    this.persistEvents();
    
    // Also log to console for immediate debugging
    const formattedTime = formatInTimeZone(debugEvent.timestamp, debugEvent.timezone, 'yyyy-MM-dd HH:mm:ss zzz');
    console.log(`[NotificationDebug] ${formattedTime} - ${event}`, {
      success,
      data: debugEvent.data,
      error,
      platform: debugEvent.platform
    });
  }

  /**
   * Log user setting changes
   */
  logUserAction(action: string, settings: any): void {
    this.logEvent('USER_ACTION', {
      action,
      settings,
      timestamp: new Date().toISOString(),
      userTimezone: this.getUserTimezone()
    });
  }

  /**
   * Log permission requests and results
   */
  logPermissionRequest(type: string, result: any): void {
    this.logEvent('PERMISSION_REQUEST', {
      type,
      result,
      platform: this.detectPlatform(),
      isWebView: this.isWebView()
    }, result.success !== false);
  }

  /**
   * Log notification scheduling attempts
   */
  logScheduleAttempt(times: string[], strategy: string, result: any): void {
    const success = result.success !== false;
    this.logEvent('SCHEDULE_ATTEMPT', {
      times,
      strategy,
      result,
      timezone: this.getUserTimezone(),
      scheduledFor: times.map(time => this.getNextTimeForTimezone(time))
    }, success, result.error);
  }

  /**
   * Log actual vs expected notification times
   */
  logTimeComparison(expected: Date, actual: Date, timezone: string): void {
    const expectedFormatted = formatInTimeZone(expected, timezone, 'yyyy-MM-dd HH:mm:ss zzz');
    const actualFormatted = formatInTimeZone(actual, timezone, 'yyyy-MM-dd HH:mm:ss zzz');
    const difference = actual.getTime() - expected.getTime();
    
    this.logEvent('TIME_COMPARISON', {
      expected: expectedFormatted,
      actual: actualFormatted,
      difference: `${difference}ms`,
      timezone,
      accuracy: Math.abs(difference) < 60000 ? 'accurate' : 'inaccurate'
    }, Math.abs(difference) < 300000); // Success if within 5 minutes
  }

  /**
   * Log notification verification results
   */
  logVerification(expectedCount: number, actualCount: number, pendingNotifications: any[]): void {
    const success = actualCount >= expectedCount * 0.8; // 80% success rate
    
    this.logEvent('NOTIFICATION_VERIFICATION', {
      expectedCount,
      actualCount,
      successRate: `${Math.round((actualCount / expectedCount) * 100)}%`,
      pendingNotifications: pendingNotifications.map(n => ({
        id: n.id,
        title: n.title,
        schedule: n.schedule
      }))
    }, success, success ? undefined : 'Low notification count detected');
  }

  /**
   * Get all debug events
   */
  getEvents(): NotificationDebugEvent[] {
    return [...this.events];
  }

  /**
   * Get events filtered by type or success status
   */
  getFilteredEvents(filter?: { event?: string; success?: boolean; since?: Date }): NotificationDebugEvent[] {
    let filtered = this.events;

    if (filter?.event) {
      filtered = filtered.filter(e => e.event.includes(filter.event!));
    }

    if (filter?.success !== undefined) {
      filtered = filtered.filter(e => e.success === filter.success);
    }

    if (filter?.since) {
      filtered = filtered.filter(e => e.timestamp >= filter.since!);
    }

    return filtered;
  }

  /**
   * Get notification system status
   */
  async getSystemStatus(): Promise<NotificationSystemStatus> {
    const status: NotificationSystemStatus = {
      isWebView: this.isWebView(),
      isNative: this.isNativePlatform(),
      platform: this.detectPlatform(),
      permissions: await this.getPermissionStatus(),
      timezone: this.getUserTimezone(),
      scheduledCount: 0
    };

    // Add platform-specific status
    if (status.isNative) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const pending = await LocalNotifications.getPending();
        status.scheduledCount = pending.notifications.length;
      } catch (error) {
        status.lastError = 'Failed to get native notification status';
      }
    }

    return status;
  }

  /**
   * Generate debug report
   */
  generateDebugReport(): string {
    const recentEvents = this.getFilteredEvents({ 
      since: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    });

    const errorEvents = this.getFilteredEvents({ success: false });
    
    return `
NOTIFICATION DEBUG REPORT
========================
Generated: ${new Date().toISOString()}
Timezone: ${this.getUserTimezone()}
Platform: ${this.detectPlatform()}
Is WebView: ${this.isWebView()}
Is Native: ${this.isNativePlatform()}

RECENT EVENTS (Last 24h): ${recentEvents.length}
ERROR EVENTS: ${errorEvents.length}

RECENT ERRORS:
${errorEvents.slice(0, 5).map(e => 
  `- ${formatInTimeZone(e.timestamp, e.timezone, 'MM-dd HH:mm')} ${e.event}: ${e.error}`
).join('\n')}

RECENT EVENTS:
${recentEvents.slice(0, 10).map(e => 
  `- ${formatInTimeZone(e.timestamp, e.timezone, 'MM-dd HH:mm')} ${e.event} (${e.success ? 'OK' : 'FAIL'})`
).join('\n')}
    `.trim();
  }

  /**
   * Clear all stored debug events
   */
  clearEvents(): void {
    this.events = [];
    localStorage.removeItem(this.STORAGE_KEY);
    this.logEvent('DEBUG_CLEARED', { clearedAt: new Date().toISOString() });
  }

  // Private helper methods

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeData(data: any): any {
    try {
      return JSON.parse(JSON.stringify(data));
    } catch {
      return { error: 'Failed to serialize data' };
    }
  }

  private detectPlatform(): string {
    if (typeof window === 'undefined') return 'server';
    
    try {
      const { Capacitor } = require('@capacitor/core');
      return Capacitor.getPlatform();
    } catch {
      return 'web';
    }
  }

  private isNativePlatform(): boolean {
    try {
      const { Capacitor } = require('@capacitor/core');
      return Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  }

  private isWebView(): boolean {
    // Enhanced WebView detection
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Check for WebView indicators
    const webViewIndicators = [
      'wv', // WebView
      'android.*version.*chrome', // Android WebView pattern
      'mobile.*safari.*version', // iOS WebView pattern
      'capacitor' // Capacitor specific
    ];

    const hasWebViewIndicator = webViewIndicators.some(indicator => 
      new RegExp(indicator).test(userAgent)
    );

    // Additional checks for Capacitor WebView
    const isCapacitorWebView = !!(window as any).Capacitor && 
                              this.isNativePlatform() && 
                              !userAgent.includes('chrome/');

    return hasWebViewIndicator || isCapacitorWebView;
  }

  private getUserTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  }

  private async getPermissionStatus(): Promise<any> {
    const status: any = {};

    if (this.isNativePlatform()) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        status.native = await LocalNotifications.checkPermissions();
      } catch (error) {
        status.nativeError = 'Failed to check native permissions';
      }
    } else {
      status.web = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
    }

    return status;
  }

  private getNextTimeForTimezone(time: string): string {
    // Simple time mapping for debug purposes
    const timeMap: Record<string, { hour: number; minute: number }> = {
      morning: { hour: 8, minute: 0 },
      afternoon: { hour: 14, minute: 0 },
      evening: { hour: 19, minute: 0 },
      night: { hour: 22, minute: 0 }
    };

    const targetTime = timeMap[time] || { hour: 12, minute: 0 };
    const now = new Date();
    const next = new Date();
    next.setHours(targetTime.hour, targetTime.minute, 0, 0);

    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return formatInTimeZone(next, this.getUserTimezone(), 'yyyy-MM-dd HH:mm:ss zzz');
  }

  private loadStoredEvents(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const events = JSON.parse(stored);
        this.events = events.map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load stored debug events:', error);
    }
  }

  private persistEvents(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.events));
    } catch (error) {
      console.warn('Failed to persist debug events:', error);
    }
  }
}

export const notificationDebugLogger = NotificationDebugLogger.getInstance();
