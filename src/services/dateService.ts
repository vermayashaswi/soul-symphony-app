
/**
 * Enhanced Unified Date Service with Fixed Week Calculations
 * 
 * This service provides a single source of truth for all date-related operations
 * with proper Monday-as-week-start handling and current year date calculations.
 */

import { 
  addDays, 
  subDays, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfDay, 
  endOfDay,
  format as formatDate,
  isValid as isDateValid,
  getWeek,
  getYear
} from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

/**
 * Client time information structure
 */
export interface ClientTimeInfo {
  timestamp: string;      // ISO timestamp from client device
  timezoneName: string;   // IANA timezone name (e.g., "America/New_York")
  timezoneOffset: number; // Timezone offset in minutes
}

/**
 * Date range response structure
 */
export interface DateRange {
  startDate: string;   // ISO start date
  endDate: string;     // ISO end date
  periodName: string;  // Human-readable period name
}

/**
 * Enhanced date range with detailed information
 */
export interface EnhancedDateRange extends DateRange {
  weekNumber?: number;
  year?: number;
  isCurrentWeek?: boolean;
  isLastWeek?: boolean;
}

/**
 * Gets the current client time information with enhanced validation
 */
export function getClientTimeInfo(): ClientTimeInfo {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  
  console.log(`[DateService] Getting client time info:`, {
    timestamp: now.toISOString(),
    timezone,
    offset: now.getTimezoneOffset(),
    localString: now.toString()
  });
  
  return {
    timestamp: now.toISOString(),
    timezoneName: timezone,
    timezoneOffset: now.getTimezoneOffset()
  };
}

/**
 * Enhanced logging for date operations with more context
 */
export function logDateOperation(
  operation: string,
  input: any,
  output: any,
  additionalInfo: Record<string, any> = {}
): void {
  const now = new Date();
  console.log(
    `[DateService] ${operation}:`,
    {
      input,
      output,
      currentServerTime: now.toISOString(),
      currentLocalTime: now.toString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      weekNumber: getWeek(now, { weekStartsOn: 1 }),
      year: getYear(now),
      ...additionalInfo
    }
  );
}

/**
 * Gets a specific timezone-aware date with enhanced validation
 */
export function getZonedDate(
  date: Date | string = new Date(),
  timezone: string = 'UTC'
): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (!isDateValid(dateObj)) {
    console.error(`[DateService] Invalid date provided: ${date}`);
    return new Date();
  }
  
  logDateOperation('Converting date to timezone', dateObj.toISOString(), timezone);
  
  try {
    const zonedDate = toZonedTime(dateObj, timezone);
    
    console.log(`[DateService] Date converted to ${timezone}:`, {
      original: dateObj.toISOString(),
      converted: zonedDate.toISOString(),
      formatted: formatDate(zonedDate, 'yyyy-MM-dd HH:mm:ss')
    });
    
    return zonedDate;
  } catch (error) {
    console.error(`[DateService] Error converting to timezone ${timezone}:`, error);
    return dateObj;
  }
}

/**
 * FIXED: Get current week date range (Monday to Sunday)
 */
export function getCurrentWeekDateRange(
  clientInfo?: ClientTimeInfo,
  userTimezone: string = 'UTC'
): { formattedRange: string; rangeObj: EnhancedDateRange } {
  const now = new Date();
  const timezone = userTimezone || clientInfo?.timezoneName || 'UTC';
  
  console.log(`[DateService] Calculating current week range for timezone: ${timezone}`);
  
  try {
    // Get the zoned current date
    const zonedNow = getZonedDate(now, timezone);
    
    // Calculate week start (Monday) and end (Sunday) with Monday as week start
    const weekStart = startOfWeek(zonedNow, { weekStartsOn: 1 }); // 1 = Monday
    const weekEnd = endOfWeek(zonedNow, { weekStartsOn: 1 });
    
    const weekNumber = getWeek(zonedNow, { weekStartsOn: 1 });
    const year = getYear(zonedNow);
    
    const formattedRange = `${formatDate(weekStart, 'EEEE, MMMM d')} - ${formatDate(weekEnd, 'EEEE, MMMM d, yyyy')}`;
    
    const rangeObj: EnhancedDateRange = {
      startDate: weekStart.toISOString(),
      endDate: weekEnd.toISOString(),
      periodName: 'Current Week',
      weekNumber,
      year,
      isCurrentWeek: true,
      isLastWeek: false
    };
    
    logDateOperation('Current week calculation', { timezone, now: now.toISOString() }, {
      formattedRange,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      weekNumber,
      year
    });
    
    return { formattedRange, rangeObj };
  } catch (error) {
    console.error('[DateService] Error calculating current week:', error);
    // Fallback to simple calculation
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    
    return {
      formattedRange: `${formatDate(weekStart, 'EEEE, MMMM d')} - ${formatDate(weekEnd, 'EEEE, MMMM d, yyyy')}`,
      rangeObj: {
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString(),
        periodName: 'Current Week',
        isCurrentWeek: true,
        isLastWeek: false
      }
    };
  }
}

/**
 * FIXED: Get last week date range (Monday to Sunday of previous week)
 */
export function getLastWeekDateRange(
  clientInfo?: ClientTimeInfo,
  userTimezone: string = 'UTC'
): { formattedRange: string; rangeObj: EnhancedDateRange } {
  const now = new Date();
  const timezone = userTimezone || clientInfo?.timezoneName || 'UTC';
  
  console.log(`[DateService] Calculating last week range for timezone: ${timezone}`);
  
  try {
    // Get the zoned current date
    const zonedNow = getZonedDate(now, timezone);
    
    // Go back 7 days to get to last week, then calculate week bounds
    const lastWeekDate = subDays(zonedNow, 7);
    const weekStart = startOfWeek(lastWeekDate, { weekStartsOn: 1 }); // 1 = Monday
    const weekEnd = endOfWeek(lastWeekDate, { weekStartsOn: 1 });
    
    const weekNumber = getWeek(lastWeekDate, { weekStartsOn: 1 });
    const year = getYear(lastWeekDate);
    
    const formattedRange = `${formatDate(weekStart, 'EEEE, MMMM d')} - ${formatDate(weekEnd, 'EEEE, MMMM d, yyyy')}`;
    
    const rangeObj: EnhancedDateRange = {
      startDate: weekStart.toISOString(),
      endDate: weekEnd.toISOString(),
      periodName: 'Last Week',
      weekNumber,
      year,
      isCurrentWeek: false,
      isLastWeek: true
    };
    
    logDateOperation('Last week calculation', { timezone, now: now.toISOString() }, {
      formattedRange,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      weekNumber,
      year
    });
    
    return { formattedRange, rangeObj };
  } catch (error) {
    console.error('[DateService] Error calculating last week:', error);
    // Fallback to simple calculation
    const lastWeekDate = subDays(now, 7);
    const weekStart = startOfWeek(lastWeekDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(lastWeekDate, { weekStartsOn: 1 });
    
    return {
      formattedRange: `${formatDate(weekStart, 'EEEE, MMMM d')} - ${formatDate(weekEnd, 'EEEE, MMMM d, yyyy')}`,
      rangeObj: {
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString(),
        periodName: 'Last Week',
        isCurrentWeek: false,
        isLastWeek: true
      }
    };
  }
}

/**
 * Enhanced direct date query detection
 */
export function isDirectDateQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  
  const directDatePatterns = [
    /^what\s+(are\s+)?the\s+dates?\s+(for\s+)?(this\s+week|current\s+week|last\s+week)(\?|\.)?$/i,
    /^when\s+(is|was)\s+(this\s+week|current\s+week|last\s+week)(\?|\.)?$/i,
    /^(this\s+week|current\s+week|last\s+week)\s+dates?(\?|\.)?$/i,
    /^this\s+week\??$/i,
    /^last\s+week\??$/i
  ];
  
  const isDirectDate = directDatePatterns.some(pattern => pattern.test(lowerMessage));
  
  console.log(`[DateService] Direct date query check for "${message}": ${isDirectDate}`);
  
  return isDirectDate;
}

/**
 * Debug timezone information with enhanced details
 */
export function debugTimezoneInfo(): void {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  console.log('[DateService] === TIMEZONE DEBUG INFO ===');
  console.log('Current date and time details:');
  console.log(`- Date object: ${now}`);
  console.log(`- ISO string: ${now.toISOString()}`);
  console.log(`- Local string: ${now.toString()}`);
  console.log(`- Timezone: ${timezone}`);
  console.log(`- Timezone offset: ${now.getTimezoneOffset()} minutes`);
  console.log(`- Formatted: ${formatDate(now, 'yyyy-MM-dd HH:mm:ss EEEE')}`);
  console.log(`- Week number: ${getWeek(now, { weekStartsOn: 1 })}`);
  console.log(`- Year: ${getYear(now)}`);
  console.log(`- Day of week: ${now.getDay()} (0=Sunday, 1=Monday, ..., 6=Saturday)`);
  
  // Test week calculations
  console.log('\n--- Week Calculations ---');
  const currentWeek = getCurrentWeekDateRange();
  const lastWeek = getLastWeekDateRange();
  
  console.log(`Current week: ${currentWeek.formattedRange}`);
  console.log(`Last week: ${lastWeek.formattedRange}`);
  console.log('=== END TIMEZONE DEBUG ===');
}

/**
 * Get current week dates as a simple string (for backwards compatibility)
 */
export function getCurrentWeekDates(): string {
  const { formattedRange } = getCurrentWeekDateRange();
  return formattedRange;
}

/**
 * Enhanced date range validation
 */
export function validateDateRange(startDate: string, endDate: string): boolean {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const isValid = isDateValid(start) && isDateValid(end) && start <= end;
  
  if (!isValid) {
    console.warn(`[DateService] Invalid date range: ${startDate} to ${endDate}`);
  }
  
  return isValid;
}

/**
 * Get date range for any time period with enhanced handling
 */
export function getDateRangeForPeriod(
  period: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth',
  timezone: string = 'UTC'
): EnhancedDateRange {
  const now = getZonedDate(new Date(), timezone);
  
  console.log(`[DateService] Getting date range for period: ${period}, timezone: ${timezone}`);
  
  switch (period) {
    case 'today': {
      const start = startOfDay(now);
      const end = endOfDay(now);
      return {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        periodName: 'Today'
      };
    }
    
    case 'yesterday': {
      const yesterday = subDays(now, 1);
      const start = startOfDay(yesterday);
      const end = endOfDay(yesterday);
      return {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        periodName: 'Yesterday'
      };
    }
    
    case 'thisWeek': {
      return getCurrentWeekDateRange(undefined, timezone).rangeObj;
    }
    
    case 'lastWeek': {
      return getLastWeekDateRange(undefined, timezone).rangeObj;
    }
    
    case 'thisMonth': {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      return {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        periodName: 'This Month'
      };
    }
    
    case 'lastMonth': {
      const lastMonth = subDays(startOfMonth(now), 1);
      const start = startOfMonth(lastMonth);
      const end = endOfMonth(lastMonth);
      return {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        periodName: 'Last Month'
      };
    }
    
    default: {
      console.warn(`[DateService] Unknown period: ${period}, defaulting to today`);
      const start = startOfDay(now);
      const end = endOfDay(now);
      return {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        periodName: 'Today'
      };
    }
  }
}
