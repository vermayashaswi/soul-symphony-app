
import { format, getDay, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, addDays, subMonths, isAfter, isBefore, subDays } from 'date-fns';
import { formatInTimeZone as fnsFormatInTimeZone, toZonedTime } from 'date-fns-tz';

// Client time info type
export interface ClientTimeInfo {
  timestamp: string;
  timezoneOffset: number;
  timezoneName: string;
  rawOffset: number;
}

/**
 * Get client's timezone information
 */
export function getClientTimeInfo(): ClientTimeInfo {
  try {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset();
    const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    return {
      timestamp: now.toISOString(),
      timezoneOffset,
      timezoneName,
      rawOffset: -timezoneOffset * 60 * 1000 // Convert minutes to milliseconds
    };
  } catch (error) {
    console.error("Error getting client timezone info:", error);
    return {
      timestamp: new Date().toISOString(),
      timezoneOffset: 0,
      timezoneName: "UTC",
      rawOffset: 0
    };
  }
}

/**
 * Get user's timezone offset in minutes
 */
export const getUserTimezoneOffset = (): number => {
  try {
    return new Date().getTimezoneOffset();
  } catch (error) {
    console.error("Error getting timezone offset:", error);
    return 0; // Default to UTC
  }
};

/**
 * Get user's timezone name
 */
export const getUserTimezoneName = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.error("Error getting timezone name:", error);
    return "UTC"; // Default to UTC
  }
};

/**
 * Format a date in a specific timezone
 */
export function formatInTimezone(date: Date | string, format: string, timezone: string = 'UTC'): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return fnsFormatInTimeZone(dateObj, timezone, format);
  } catch (error) {
    console.error("Error formatting date in timezone:", error);
    return format;
  }
}

/**
 * Debug helper for timezone issues
 */
export function debugTimezoneInfo() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset();
  const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  console.log("Date/Time Debugging Information:");
  console.log(`Current time: ${now.toISOString()}`);
  console.log(`Local time string: ${now.toString()}`);
  console.log(`Timezone offset: ${tzOffset} minutes`);
  console.log(`Timezone name: ${tzName}`);
  
  const formatted = format(now, 'yyyy-MM-dd HH:mm:ss');
  console.log(`Formatted local time: ${formatted}`);
  
  // Calculate week days
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ...
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
  const mondayDate = new Date(today);
  mondayDate.setDate(today.getDate() - daysFromMonday);
  
  console.log(`Today is day ${currentDay} of week (0=Sunday, 1=Monday)`);
  console.log(`Days from Monday: ${daysFromMonday}`);
  console.log(`This week's Monday: ${mondayDate.toDateString()}`);
  
  // Last week calculation
  const lastWeekMonday = new Date(mondayDate);
  lastWeekMonday.setDate(mondayDate.getDate() - 7);
  const lastWeekSunday = new Date(mondayDate);
  lastWeekSunday.setDate(mondayDate.getDate() - 1);
  
  console.log(`Last week's Monday: ${lastWeekMonday.toDateString()}`);
  console.log(`Last week's Sunday: ${lastWeekSunday.toDateString()}`);
  
  return {
    now,
    tzOffset,
    tzName,
    formatted,
    thisWeekMonday: mondayDate,
    lastWeekMonday,
    lastWeekSunday
  };
}

/**
 * Get the date range for last week with proper formatting
 */
export function getLastWeekDateRange(
  clientTimeInfo?: { timezoneName?: string; timestamp?: string },
  userTimezone?: string
): { 
  startDate: string; 
  endDate: string; 
  formattedRange: string;
} {
  console.log(`Getting last week date range with timezone: ${userTimezone || clientTimeInfo?.timezoneName || 'UTC'}`);
  
  // Get current reference time (use client time if provided)
  const referenceDate = clientTimeInfo?.timestamp 
    ? parseISO(clientTimeInfo.timestamp)
    : new Date();
    
  console.log(`Reference date for last week calculation: ${referenceDate.toISOString()}`);
    
  // Get the current day of the week (0 = Sunday, 1 = Monday, ...)
  const currentDay = getDay(referenceDate);
  
  // Calculate days from Monday (if today is Sunday, it's 6 days from last Monday)
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
  
  // Get this week's Monday
  const thisWeekMonday = startOfDay(
    subDays(referenceDate, daysFromMonday)
  );
  
  // Calculate last week's Monday and Sunday
  const lastWeekMonday = subDays(thisWeekMonday, 7);
  const lastWeekSunday = subDays(thisWeekMonday, 1);
  
  // Format the date range for display
  const startFormatted = format(lastWeekMonday, 'MMMM d');
  const endFormatted = format(lastWeekSunday, 'MMMM d, yyyy');
  const formattedRange = `${startFormatted} to ${endFormatted}`;
  
  console.log(`Calculated last week range: ${formattedRange}`);
  console.log(`Last week start: ${lastWeekMonday.toISOString()}`);
  console.log(`Last week end: ${lastWeekSunday.toISOString()}`);
  
  return {
    startDate: lastWeekMonday.toISOString(),
    endDate: endOfDay(lastWeekSunday).toISOString(),
    formattedRange
  };
}

/**
 * Get the date range for current week with proper formatting
 */
export function getCurrentWeekDateRange(
  clientTimeInfo?: { timezoneName?: string; timestamp?: string },
  userTimezone?: string
): {
  startDate: string;
  endDate: string;
  formattedRange: string;
} {
  // Get current reference time (use client time if provided)
  const referenceDate = clientTimeInfo?.timestamp 
    ? parseISO(clientTimeInfo.timestamp)
    : new Date();
  
  // Get the current day of the week (0 = Sunday, 1 = Monday, ...)
  const currentDay = getDay(referenceDate);
  
  // Calculate days from Monday
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
  
  // Get this week's Monday
  const thisWeekMonday = startOfDay(
    subDays(referenceDate, daysFromMonday)
  );
  
  // Get this week's Sunday
  const thisWeekSunday = addDays(thisWeekMonday, 6);
  
  // Format the date range for display
  const startFormatted = format(thisWeekMonday, 'MMMM d');
  const endFormatted = format(thisWeekSunday, 'MMMM d, yyyy');
  const formattedRange = `${startFormatted} to ${endFormatted}`;
  
  return {
    startDate: thisWeekMonday.toISOString(),
    endDate: endOfDay(thisWeekSunday).toISOString(),
    formattedRange
  };
}

/**
 * Calculate date range based on time period expression
 */
export function calculateDateRange(
  timePeriod: string,
  clientTimeInfo?: { timezoneName?: string; timestamp?: string; timezoneOffset?: number },
  userTimezone?: string
): {
  startDate: string;
  endDate: string;
  periodName: string;
} {
  try {
    console.log(`Calculating date range for time period: "${timePeriod}"`);
    
    // Use provided timestamp or current time
    const referenceTime = clientTimeInfo?.timestamp 
      ? new Date(clientTimeInfo.timestamp) 
      : new Date();
      
    // Clean up time period text for matching
    const cleanTimePeriod = timePeriod.toLowerCase().trim();
    
    // Simple cases first
    if (cleanTimePeriod.includes('today')) {
      const today = startOfDay(referenceTime);
      return {
        startDate: today.toISOString(),
        endDate: endOfDay(today).toISOString(),
        periodName: 'today'
      };
    }
    
    if (cleanTimePeriod.includes('yesterday')) {
      const yesterday = startOfDay(subDays(referenceTime, 1));
      return {
        startDate: yesterday.toISOString(),
        endDate: endOfDay(yesterday).toISOString(),
        periodName: 'yesterday'
      };
    }
    
    // This week
    if (cleanTimePeriod.includes('this week')) {
      const weekData = getCurrentWeekDateRange(clientTimeInfo, userTimezone);
      return {
        startDate: weekData.startDate,
        endDate: weekData.endDate,
        periodName: 'this week'
      };
    }
    
    // Last week
    if (cleanTimePeriod.includes('last week')) {
      const weekData = getLastWeekDateRange(clientTimeInfo, userTimezone);
      return {
        startDate: weekData.startDate,
        endDate: weekData.endDate,
        periodName: 'last week'
      };
    }
    
    // This month
    if (cleanTimePeriod.includes('this month')) {
      const thisMonth = startOfMonth(referenceTime);
      return {
        startDate: thisMonth.toISOString(),
        endDate: endOfMonth(referenceTime).toISOString(),
        periodName: 'this month'
      };
    }
    
    // Last month
    if (cleanTimePeriod.includes('last month')) {
      const lastMonth = startOfMonth(subMonths(referenceTime, 1));
      return {
        startDate: lastMonth.toISOString(),
        endDate: endOfMonth(subMonths(referenceTime, 1)).toISOString(),
        periodName: 'last month'
      };
    }
    
    // Default to all time
    return {
      startDate: '',
      endDate: '',
      periodName: 'all time'
    };
  } catch (error) {
    console.error("Error calculating date range:", error);
    
    // Default to all time on error
    return {
      startDate: '',
      endDate: '',
      periodName: 'all time'
    };
  }
}

/**
 * Check if a date query can be answered directly without searching journal entries
 */
export function isDirectDateQuery(query: string): boolean {
  if (!query) return false;
  
  const lowerQuery = query.toLowerCase().trim();
  
  // Direct date queries that can be answered without journal searching
  const patterns = [
    /^what\s+(dates?|days?|time)\s+(are|is|was|were)\s+(the|this|last)\s+(current|week|month|year)/i,
    /^when\s+(is|was)\s+(the|this|last)\s+(week|month|year)/i,
    /^(what is|what are) the dates? (for|of) (the |this |last )?(current |ongoing )?(week|month|year)/i,
    /^(tell me|show me) (the dates? for|when is) (the |this |last )?(current |ongoing )?(week|month|year)/i
  ];
  
  return patterns.some(pattern => pattern.test(lowerQuery));
}
