import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { supabase } from '@/integrations/supabase/client';

export type JournalReminderTime = 'morning' | 'afternoon' | 'evening' | 'night';

export interface ExactReminderTime {
  hour: number;
  minute: number;
  timezone: string;
  nextOccurrence: Date;
  nextOccurrenceFormatted: string;
  exactTimeString: string; // HH:MM format
}

export interface TimezoneAwareReminderTime {
  time: JournalReminderTime;
  hour: number;
  minute: number;
  timezone: string;
  nextOccurrence: Date;
  nextOccurrenceFormatted: string;
}

/**
 * Enhanced timezone-aware notification helper using date-fns-tz
 */
class TimezoneNotificationHelper {
  private static instance: TimezoneNotificationHelper;
  private userTimezone: string = 'UTC';

  static getInstance(): TimezoneNotificationHelper {
    if (!TimezoneNotificationHelper.instance) {
      TimezoneNotificationHelper.instance = new TimezoneNotificationHelper();
    }
    return TimezoneNotificationHelper.instance;
  }

  constructor() {
    this.initializeUserTimezone();
  }

  /**
   * Initialize user timezone from browser and profile
   */
  async initializeUserTimezone(): Promise<void> {
    try {
      // Get browser timezone as fallback
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      this.userTimezone = browserTimezone;

      // Try to get user's saved timezone from profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile && !error) {
          // Try to get timezone from profile (handle different column names)
          const profileTimezone = (profile as any).timezone || (profile as any).user_timezone;
          if (profileTimezone) {
            this.userTimezone = profileTimezone;
            console.log(`[TimezoneHelper] Using profile timezone: ${this.userTimezone}`);
          } else {
            console.log(`[TimezoneHelper] Using browser timezone: ${this.userTimezone}`);
          }
        } else {
          console.log(`[TimezoneHelper] Using browser timezone: ${this.userTimezone}`);
        }
      }
    } catch (error) {
      console.warn('[TimezoneHelper] Failed to get user timezone, using UTC:', error);
      this.userTimezone = 'UTC';
    }
  }

  /**
   * Get user's current timezone
   */
  getUserTimezone(): string {
    return this.userTimezone;
  }

  /**
   * Set user timezone manually
   */
  setUserTimezone(timezone: string): void {
    this.userTimezone = timezone;
  }

  /**
   * Get timezone-aware reminder time calculations
   */
  getTimezoneAwareReminderTime(time: JournalReminderTime): TimezoneAwareReminderTime {
    const timeMapping: Record<JournalReminderTime, { hour: number; minute: number }> = {
      morning: { hour: 8, minute: 0 },
      afternoon: { hour: 14, minute: 0 },
      evening: { hour: 19, minute: 0 },
      night: { hour: 22, minute: 0 }
    };

    const { hour, minute } = timeMapping[time];
    const nextOccurrence = this.getNextReminderTimeInTimezone(time);

    return {
      time,
      hour,
      minute,
      timezone: this.userTimezone,
      nextOccurrence,
      nextOccurrenceFormatted: formatInTimeZone(
        nextOccurrence, 
        this.userTimezone, 
        'yyyy-MM-dd HH:mm:ss zzz'
      )
    };
  }

  /**
   * Calculate next reminder time in user's timezone using exact hour/minute
   */
  getNextExactReminderTimeInTimezone(hour: number, minute: number): Date {
    console.log(`[TimezoneHelper] Calculating exact time: ${hour}:${minute} in ${this.userTimezone}`);
    
    // Get current time in UTC
    const nowUTC = new Date();
    
    // Create target time for today in user's timezone
    const todayInUserTz = toZonedTime(nowUTC, this.userTimezone);
    todayInUserTz.setHours(hour, minute, 0, 0);
    
    // If target time has passed today, schedule for tomorrow
    let targetTime = todayInUserTz;
    const nowInUserTz = toZonedTime(nowUTC, this.userTimezone);
    
    if (targetTime <= nowInUserTz) {
      targetTime = new Date(todayInUserTz);
      targetTime.setDate(targetTime.getDate() + 1);
    }

    // Convert from user timezone to UTC using proper date-fns-tz function
    const targetTimeUTC = fromZonedTime(targetTime, this.userTimezone);

    console.log(`[TimezoneHelper] Exact time calculation:`, {
      userTimezone: this.userTimezone,
      inputTime: `${hour}:${minute}`,
      currentUTC: nowUTC.toISOString(),
      currentUserTime: formatInTimeZone(nowUTC, this.userTimezone, 'yyyy-MM-dd HH:mm:ss zzz'),
      targetUserTime: formatInTimeZone(targetTime, this.userTimezone, 'yyyy-MM-dd HH:mm:ss zzz'),
      targetUTC: targetTimeUTC.toISOString(),
      hoursFromNow: (targetTimeUTC.getTime() - nowUTC.getTime()) / (1000 * 60 * 60)
    });

    return targetTimeUTC;
  }

  /**
   * Calculate next reminder time in user's timezone (legacy - for backward compatibility)
   */
  getNextReminderTimeInTimezone(time: JournalReminderTime): Date {
    const timeMapping: Record<JournalReminderTime, { hour: number; minute: number }> = {
      morning: { hour: 8, minute: 0 },
      afternoon: { hour: 14, minute: 0 },
      evening: { hour: 19, minute: 0 },
      night: { hour: 22, minute: 0 }
    };

    const { hour, minute } = timeMapping[time];
    return this.getNextExactReminderTimeInTimezone(hour, minute);
  }

  /**
   * Generate absolute notification times for exact hour/minute for next N days
   */
  generateAbsoluteTimesForExactTime(hour: number, minute: number, days: number): Date[] {
    const times: Date[] = [];
    
    // Get current time in UTC
    const nowUTC = new Date();
    const nowInUserTz = toZonedTime(nowUTC, this.userTimezone);
    
    for (let i = 0; i < days; i++) {
      // Create target time for each day in user's timezone
      const targetDay = new Date(nowInUserTz);
      targetDay.setDate(nowInUserTz.getDate() + i);
      targetDay.setHours(hour, minute, 0, 0);
      
      // Skip if time has already passed today (only for day 0)
      if (i === 0 && targetDay <= nowInUserTz) {
        continue;
      }
      
      // Convert to UTC using proper date-fns-tz function
      const targetTimeUTC = fromZonedTime(targetDay, this.userTimezone);
      times.push(targetTimeUTC);
    }

    console.log(`[TimezoneHelper] Generated ${times.length} absolute times for ${hour}:${minute}:`, 
      times.map(t => formatInTimeZone(t, this.userTimezone, 'yyyy-MM-dd HH:mm zzz'))
    );

    return times;
  }

  /**
   * Generate absolute notification times for next N days (legacy)
   */
  generateAbsoluteTimesInTimezone(time: JournalReminderTime, days: number): Date[] {
    const timeMapping: Record<JournalReminderTime, { hour: number; minute: number }> = {
      morning: { hour: 8, minute: 0 },
      afternoon: { hour: 14, minute: 0 },
      evening: { hour: 19, minute: 0 },
      night: { hour: 22, minute: 0 }
    };

    const { hour, minute } = timeMapping[time];
    return this.generateAbsoluteTimesForExactTime(hour, minute, days);
  }

  /**
   * Convert local time settings to timezone-aware format
   */
  convertReminderTimesToTimezone(times: JournalReminderTime[]): TimezoneAwareReminderTime[] {
    return times.map(time => this.getTimezoneAwareReminderTime(time));
  }

  /**
   * Validate if a time is in the future considering timezone
   */
  isTimeInFuture(targetTime: Date): boolean {
    const nowInUserTz = toZonedTime(new Date(), this.userTimezone);
    const targetInUserTz = toZonedTime(targetTime, this.userTimezone);
    
    return targetInUserTz > nowInUserTz;
  }

  /**
   * Format time for user display in their timezone
   */
  formatTimeForUser(date: Date, format: string = 'yyyy-MM-dd HH:mm:ss zzz'): string {
    return formatInTimeZone(date, this.userTimezone, format);
  }

  /**
   * Get debugging info for timezone calculations
   */
  getTimezoneDebugInfo(): any {
    const now = new Date();
    const nowInUserTz = toZonedTime(now, this.userTimezone);
    
    return {
      userTimezone: this.userTimezone,
      browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      currentUTC: now.toISOString(),
      currentUserTime: formatInTimeZone(now, this.userTimezone, 'yyyy-MM-dd HH:mm:ss zzz'),
      timezoneOffset: nowInUserTz.getTimezoneOffset(),
      isDST: now.getTimezoneOffset() !== nowInUserTz.getTimezoneOffset()
    };
  }

  /**
   * Calculate exact reminder time from HH:MM string
   */
  getExactReminderTime(timeString: string): ExactReminderTime {
    const [hourStr, minuteStr] = timeString.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    
    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new Error(`Invalid time format: ${timeString}. Expected HH:MM format.`);
    }

    const nextOccurrence = this.getNextExactReminderTimeInTimezone(hour, minute);

    return {
      hour,
      minute,
      timezone: this.userTimezone,
      nextOccurrence,
      nextOccurrenceFormatted: formatInTimeZone(
        nextOccurrence, 
        this.userTimezone, 
        'yyyy-MM-dd HH:mm:ss zzz'
      ),
      exactTimeString: timeString
    };
  }

  /**
   * Parse time string and return components for scheduling
   */
  parseTimeString(timeString: string): { hour: number; minute: number } {
    const [hourStr, minuteStr] = timeString.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    
    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new Error(`Invalid time format: ${timeString}. Expected HH:MM format.`);
    }

    return { hour, minute };
  }

  /**
   * Calculate time difference between scheduled and actual notification
   */
  calculateTimeDrift(scheduledTime: Date, actualTime: Date): {
    driftMs: number;
    driftFormatted: string;
    isAccurate: boolean;
  } {
    const driftMs = actualTime.getTime() - scheduledTime.getTime();
    const driftMinutes = Math.round(driftMs / 60000);
    const isAccurate = Math.abs(driftMs) < 300000; // Within 5 minutes
    
    return {
      driftMs,
      driftFormatted: `${driftMinutes} minutes ${driftMs > 0 ? 'late' : 'early'}`,
      isAccurate
    };
  }

  /**
   * Create a test notification scheduled for 30 seconds from now
   */
  getTestNotificationTime(): Date {
    const testTime = new Date(Date.now() + 30000); // 30 seconds from now
    console.log('[TimezoneHelper] Test notification scheduled for:', testTime.toISOString());
    return testTime;
  }
}

export const timezoneNotificationHelper = TimezoneNotificationHelper.getInstance();