import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format, addDays, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';

export interface TimeInfo {
  utcTimestamp: number;
  localTimestamp: number;
  timezone: string;
  offset: number;
  deviceTime: Date;
  formattedLocal: string;
  formattedUTC: string;
}

export interface NotificationScheduleTime {
  utcTimestamp: number;
  localTimestamp: number;
  timezone: string;
  scheduledFor: string;
  verificationKey: string;
}

class NativeTimeService {
  private static instance: NativeTimeService;
  private detectedTimezone: string | null = null;
  private isInitialized = false;

  static getInstance(): NativeTimeService {
    if (!NativeTimeService.instance) {
      NativeTimeService.instance = new NativeTimeService();
    }
    return NativeTimeService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[NativeTimeService] Initializing time service...');
      
      // Detect timezone using multiple methods for reliability
      await this.detectTimezone();
      
      this.isInitialized = true;
      console.log('[NativeTimeService] Initialized successfully with timezone:', this.detectedTimezone);
    } catch (error) {
      console.error('[NativeTimeService] Failed to initialize:', error);
      throw error;
    }
  }

  private async detectTimezone(): Promise<void> {
    try {
      // Method 1: Use browser Intl API (most reliable on web)
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Method 2: Use Capacitor Device info if available
      let deviceTimezone: string | undefined;
      if (Capacitor.isNativePlatform()) {
        try {
          const deviceInfo = await Device.getInfo();
          console.log('[NativeTimeService] Device info available');
        } catch (error) {
          console.log('[NativeTimeService] Device info not available:', error);
        }
      }

      // Use browser timezone as primary, device as fallback
      this.detectedTimezone = browserTimezone || deviceTimezone || 'UTC';
      
      console.log('[NativeTimeService] Detected timezone:', this.detectedTimezone);
      console.log('[NativeTimeService] Platform:', Capacitor.getPlatform());
    } catch (error) {
      console.error('[NativeTimeService] Timezone detection failed:', error);
      this.detectedTimezone = 'UTC';
    }
  }

  getTimezone(): string {
    if (!this.isInitialized) {
      throw new Error('NativeTimeService not initialized');
    }
    return this.detectedTimezone || 'UTC';
  }

  getCurrentTimeInfo(): TimeInfo {
    const timezone = this.getTimezone();
    const now = new Date();
    const utcTimestamp = now.getTime();
    
    // Get local time in detected timezone
    const zonedTime = toZonedTime(now, timezone);
    const localTimestamp = zonedTime.getTime();
    
    // Calculate offset in minutes
    const offset = now.getTimezoneOffset();

    return {
      utcTimestamp,
      localTimestamp,
      timezone,
      offset,
      deviceTime: now,
      formattedLocal: formatInTimeZone(now, timezone, 'yyyy-MM-dd HH:mm:ss zzz'),
      formattedUTC: format(now, 'yyyy-MM-dd HH:mm:ss') + ' UTC'
    };
  }

  /**
   * Calculate the next notification time for a given time slot
   * Returns UTC timestamp for reliable native scheduling
   */
  calculateNextNotificationTime(timeSlot: 'morning' | 'afternoon' | 'evening' | 'night'): NotificationScheduleTime {
    const timezone = this.getTimezone();
    const now = new Date();
    
    // Define times for each slot
    const timeMapping = {
      morning: { hour: 8, minute: 0 },
      afternoon: { hour: 14, minute: 0 },
      evening: { hour: 19, minute: 0 },
      night: { hour: 22, minute: 0 }
    };

    const { hour, minute } = timeMapping[timeSlot];

    // Create target time for today in user's timezone
    let targetDate = setMilliseconds(
      setSeconds(
        setMinutes(
          setHours(now, hour),
          minute
        ),
        0
      ),
      0
    );

    // If the time has already passed today, schedule for tomorrow
    if (targetDate.getTime() <= now.getTime()) {
      targetDate = addDays(targetDate, 1);
    }

    // Convert to UTC for native scheduling
    const utcTimestamp = fromZonedTime(targetDate, timezone).getTime();
    const localTimestamp = targetDate.getTime();

    // Create verification key for debugging
    const verificationKey = `${timeSlot}_${format(targetDate, 'yyyyMMdd_HHmm')}_${timezone}`;

    console.log('[NativeTimeService] Calculated notification time:', {
      timeSlot,
      timezone,
      localTime: formatInTimeZone(targetDate, timezone, 'yyyy-MM-dd HH:mm:ss zzz'),
      utcTime: format(new Date(utcTimestamp), 'yyyy-MM-dd HH:mm:ss') + ' UTC',
      utcTimestamp,
      verificationKey
    });

    return {
      utcTimestamp,
      localTimestamp,
      timezone,
      scheduledFor: formatInTimeZone(targetDate, timezone, 'yyyy-MM-dd HH:mm:ss zzz'),
      verificationKey
    };
  }

  /**
   * Verify that a scheduled time is correct
   */
  verifyScheduledTime(scheduleTime: NotificationScheduleTime): boolean {
    try {
      const currentTime = this.getCurrentTimeInfo();
      const scheduledDate = new Date(scheduleTime.utcTimestamp);
      const now = new Date(currentTime.utcTimestamp);

      // Check if scheduled time is in the future
      const isInFuture = scheduledDate.getTime() > now.getTime();
      
      // Check if timezone matches
      const timezoneMatches = scheduleTime.timezone === currentTime.timezone;

      console.log('[NativeTimeService] Time verification:', {
        scheduleTime: scheduleTime.scheduledFor,
        currentTime: currentTime.formattedLocal,
        isInFuture,
        timezoneMatches,
        verificationKey: scheduleTime.verificationKey
      });

      return isInFuture && timezoneMatches;
    } catch (error) {
      console.error('[NativeTimeService] Time verification failed:', error);
      return false;
    }
  }

  /**
   * Convert local time to UTC timestamp for native scheduling
   */
  localToUTCTimestamp(localDate: Date): number {
    const timezone = this.getTimezone();
    return fromZonedTime(localDate, timezone).getTime();
  }

  /**
   * Convert UTC timestamp to local time
   */
  utcToLocalTime(utcTimestamp: number): Date {
    const timezone = this.getTimezone();
    return toZonedTime(new Date(utcTimestamp), timezone);
  }

  /**
   * Format time for display in user's timezone
   */
  formatTimeForUser(timestamp: number): string {
    const timezone = this.getTimezone();
    return formatInTimeZone(new Date(timestamp), timezone, 'MMM dd, yyyy \'at\' h:mm a zzz');
  }
}

export const nativeTimeService = NativeTimeService.getInstance();