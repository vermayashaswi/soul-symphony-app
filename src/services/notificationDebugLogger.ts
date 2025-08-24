/**
 * Notification Debug Logger
 * 
 * Comprehensive logging system for notification debugging
 * Tracks user actions, scheduling attempts, and system status
 */

import { getNotificationTimezoneConfig, debugNotificationTiming } from '@/utils/notification-timezone-helper';
import { Capacitor } from '@capacitor/core';

export interface NotificationDebugEvent {
  id: string;
  timestamp: string;
  event: 'user_action' | 'permission_request' | 'scheduling' | 'notification_fired' | 'error' | 'system_check';
  component: string;
  action: string;
  data: any;
  timezone: string;
  environment: 'web' | 'capacitor_webview' | 'native_ios' | 'native_android';
  userAgent?: string;
}

export interface NotificationSchedulingAttempt {
  id: string;
  timestamp: string;
  selectedTimes: string[];
  userTimezone: string;
  detectedTimezone: string;
  environment: string;
  success: boolean;
  scheduledFor: { [time: string]: string };
  errors?: string[];
  permissions: any;
  systemStatus: any;
}

class NotificationDebugLogger {
  private static instance: NotificationDebugLogger;
  private events: NotificationDebugEvent[] = [];
  private schedulingAttempts: NotificationSchedulingAttempt[] = [];
  private readonly MAX_EVENTS = 500;
  private readonly MAX_ATTEMPTS = 50;
  private readonly STORAGE_KEY_EVENTS = 'notification_debug_events';
  private readonly STORAGE_KEY_ATTEMPTS = 'notification_scheduling_attempts';

  static getInstance(): NotificationDebugLogger {
    if (!NotificationDebugLogger.instance) {
      NotificationDebugLogger.instance = new NotificationDebugLogger();
    }
    return NotificationDebugLogger.instance;
  }

  constructor() {
    this.loadFromStorage();
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getEnvironment(): 'web' | 'capacitor_webview' | 'native_ios' | 'native_android' {
    if (!Capacitor.isNativePlatform()) {
      return 'web';
    }
    
    const platform = Capacitor.getPlatform();
    
    // Check if we're in a WebView context vs true native
    // In Capacitor WebView, window object exists but we're technically "native"
    if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
      return 'capacitor_webview';
    }
    
    return platform === 'ios' ? 'native_ios' : 'native_android';
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY_EVENTS, JSON.stringify(this.events.slice(-this.MAX_EVENTS)));
      localStorage.setItem(this.STORAGE_KEY_ATTEMPTS, JSON.stringify(this.schedulingAttempts.slice(-this.MAX_ATTEMPTS)));
    } catch (error) {
      console.warn('[NotificationDebugLogger] Failed to save to storage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const eventsJson = localStorage.getItem(this.STORAGE_KEY_EVENTS);
      const attemptsJson = localStorage.getItem(this.STORAGE_KEY_ATTEMPTS);
      
      if (eventsJson) {
        this.events = JSON.parse(eventsJson);
      }
      
      if (attemptsJson) {
        this.schedulingAttempts = JSON.parse(attemptsJson);
      }
    } catch (error) {
      console.warn('[NotificationDebugLogger] Failed to load from storage:', error);
      this.events = [];
      this.schedulingAttempts = [];
    }
  }

  /**
   * Log a general notification event
   */
  logEvent(
    event: NotificationDebugEvent['event'],
    component: string,
    action: string,
    data: any = {}
  ): void {
    const timezoneConfig = getNotificationTimezoneConfig();
    
    const debugEvent: NotificationDebugEvent = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      event,
      component,
      action,
      data,
      timezone: timezoneConfig.userTimezone,
      environment: this.getEnvironment(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
    };

    this.events.push(debugEvent);
    
    // Keep only the most recent events
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }
    
    this.saveToStorage();
    
    console.log('[NotificationDebugLogger]', debugEvent);
  }

  /**
   * Log a comprehensive scheduling attempt
   */
  logSchedulingAttempt(
    selectedTimes: string[],
    userTimezone: string | undefined,
    success: boolean,
    scheduledFor: { [time: string]: string } = {},
    errors: string[] = [],
    permissions: any = {},
    systemStatus: any = {}
  ): void {
    const timezoneConfig = getNotificationTimezoneConfig(userTimezone);
    
    const attempt: NotificationSchedulingAttempt = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      selectedTimes,
      userTimezone: userTimezone || 'auto-detected',
      detectedTimezone: timezoneConfig.userTimezone,
      environment: this.getEnvironment(),
      success,
      scheduledFor,
      errors: errors.length > 0 ? errors : undefined,
      permissions,
      systemStatus
    };

    this.schedulingAttempts.push(attempt);
    
    // Keep only the most recent attempts
    if (this.schedulingAttempts.length > this.MAX_ATTEMPTS) {
      this.schedulingAttempts = this.schedulingAttempts.slice(-this.MAX_ATTEMPTS);
    }
    
    this.saveToStorage();
    
    console.log('[NotificationDebugLogger] Scheduling Attempt:', attempt);
    
    // Also trigger timezone debugging
    debugNotificationTiming(userTimezone);
  }

  /**
   * Log user clicking "Save Settings" with selected times
   */
  logUserSaveSettings(selectedTimes: string[], enabled: boolean, userTimezone?: string): void {
    this.logEvent('user_action', 'JournalReminderSettings', 'save_settings', {
      selectedTimes,
      enabled,
      userTimezone,
      timezoneDetection: getNotificationTimezoneConfig(userTimezone),
      browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: new Date().toLocaleString()
    });
  }

  /**
   * Get all debugging data for display
   */
  getDebugData(): {
    events: NotificationDebugEvent[];
    schedulingAttempts: NotificationSchedulingAttempt[];
    summary: any;
  } {
    const recentEvents = this.events.slice(-20);
    const recentAttempts = this.schedulingAttempts.slice(-10);
    
    const summary = {
      totalEvents: this.events.length,
      totalAttempts: this.schedulingAttempts.length,
      successfulAttempts: this.schedulingAttempts.filter(a => a.success).length,
      failedAttempts: this.schedulingAttempts.filter(a => !a.success).length,
      environment: this.getEnvironment(),
      lastActivity: this.events.length > 0 ? this.events[this.events.length - 1].timestamp : null,
      currentTimezone: getNotificationTimezoneConfig(),
    };

    return {
      events: recentEvents,
      schedulingAttempts: recentAttempts,
      summary
    };
  }

  /**
   * Clear all debug data
   */
  clearDebugData(): void {
    this.events = [];
    this.schedulingAttempts = [];
    
    localStorage.removeItem(this.STORAGE_KEY_EVENTS);
    localStorage.removeItem(this.STORAGE_KEY_ATTEMPTS);
    
    console.log('[NotificationDebugLogger] All debug data cleared');
  }

  /**
   * Export debug data for sharing/analysis
   */
  exportDebugData(): string {
    const data = {
      ...this.getDebugData(),
      exportTimestamp: new Date().toISOString(),
      environment: this.getEnvironment(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      capacitorInfo: {
        isNative: Capacitor.isNativePlatform(),
        platform: Capacitor.getPlatform()
      }
    };
    
    return JSON.stringify(data, null, 2);
  }
}

export const notificationDebugLogger = NotificationDebugLogger.getInstance();
