/**
 * Notification Timezone Helper
 * 
 * This utility helps ensure notification times are correctly calculated
 * in the user's local timezone for Capacitor WebView environments
 */

import { getClientTimeInfo } from '@/services/dateService';

export interface TimezoneNotificationConfig {
  userTimezone: string;
  localTime: string;
  isValid: boolean;
  debugInfo: {
    browserTimezone: string;
    timezoneOffset: number;
    currentTime: string;
  };
}

/**
 * Gets comprehensive timezone configuration for notifications
 */
export function getNotificationTimezoneConfig(userTimezone?: string): TimezoneNotificationConfig {
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();
  
  const finalTimezone = userTimezone || browserTimezone || 'UTC';
  
  const clientInfo = getClientTimeInfo();
  
  const config: TimezoneNotificationConfig = {
    userTimezone: finalTimezone,
    localTime: now.toLocaleString('en-US', { timeZone: finalTimezone }),
    isValid: isValidTimezone(finalTimezone),
    debugInfo: {
      browserTimezone,
      timezoneOffset: now.getTimezoneOffset(),
      currentTime: now.toISOString()
    }
  };
  
  console.log('[NotificationTimezoneHelper] Generated config:', config);
  
  return config;
}

/**
 * Validates if a timezone string is valid
 */
function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    console.warn('[NotificationTimezoneHelper] Invalid timezone:', timezone, error);
    return false;
  }
}

/**
 * Converts a time slot to the next occurrence in user's timezone
 */
export function getNextNotificationTime(
  timeSlot: { hour: number; minute: number }, 
  timezone: string
): Date {
  const now = new Date();
  const next = new Date();
  
  // Set the target time
  next.setHours(timeSlot.hour, timeSlot.minute, 0, 0);
  
  // If the time has passed today, schedule for tomorrow
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  
  console.log(`[NotificationTimezoneHelper] Next notification for ${timeSlot.hour}:${String(timeSlot.minute).padStart(2, '0')}:`, {
    scheduledFor: next.toLocaleString('en-US', { timeZone: timezone }),
    timezone,
    delay: next.getTime() - now.getTime()
  });
  
  return next;
}

/**
 * Debug function to log timezone information for troubleshooting
 */
export function debugNotificationTiming(userTimezone?: string): void {
  const config = getNotificationTimezoneConfig(userTimezone);
  const timeSlots = [
    { hour: 8, minute: 0, name: 'morning' },
    { hour: 14, minute: 0, name: 'afternoon' },
    { hour: 19, minute: 0, name: 'evening' },
    { hour: 22, minute: 0, name: 'night' }
  ];
  
  console.log('[NotificationTimezoneHelper] === NOTIFICATION TIMING DEBUG ===');
  console.log('Configuration:', config);
  
  console.log('\nNext notification times:');
  timeSlots.forEach(slot => {
    const nextTime = getNextNotificationTime(slot, config.userTimezone);
    console.log(`${slot.name}: ${nextTime.toLocaleString('en-US', { timeZone: config.userTimezone })}`);
  });
  
  console.log('=== END DEBUG ===');
}