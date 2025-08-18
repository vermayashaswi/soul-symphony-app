
// Import all date functions directly from date-fns with specific version
import { format, parseISO, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'https://esm.sh/date-fns@4.1.0';

// Import timezone function using the correct import path for v3.2.0
import { toZonedTime } from 'https://esm.sh/date-fns-tz@3.2.0';

/**
 * Convert user's local date range to UTC range for database queries
 * This is crucial because entries are stored in UTC but users query in local time
 */
function convertLocalDateRangeToUTC(startDate: Date, endDate: Date, userTimezone: string): { startDateUTC: string, endDateUTC: string } {
  console.log(`[DateProcessor] Converting local date range to UTC:`);
  console.log(`Input - Start: ${startDate.toISOString()}, End: ${endDate.toISOString()}`);
  console.log(`User timezone: ${userTimezone}`);
  
  // The input dates are already in the user's local time context
  // We need to find the UTC range that corresponds to the full local day
  
  // For start date: get the beginning of the day in user's timezone, then convert to UTC
  const localStartOfDay = startOfDay(startDate);
  const utcStartOfDay = new Date(localStartOfDay.getTime() - (getTimezoneOffset(userTimezone) * 60 * 1000));
  
  // For end date: get the end of the day in user's timezone, then convert to UTC
  const localEndOfDay = endOfDay(endDate);
  const utcEndOfDay = new Date(localEndOfDay.getTime() - (getTimezoneOffset(userTimezone) * 60 * 1000));
  
  const result = {
    startDateUTC: utcStartOfDay.toISOString(),
    endDateUTC: utcEndOfDay.toISOString()
  };
  
  console.log(`[DateProcessor] UTC conversion result:`);
  console.log(`UTC Start: ${result.startDateUTC}`);
  console.log(`UTC End: ${result.endDateUTC}`);
  
  return result;
}

/**
 * Get timezone offset in minutes for a given timezone
 */
function getTimezoneOffset(timezone: string): number {
  try {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const targetTime = new Date(utcTime + (getTimezoneOffsetMinutes(timezone) * 60000));
    return targetTime.getTimezoneOffset();
  } catch (error) {
    console.error(`Error getting timezone offset for ${timezone}:`, error);
    return 0; // Default to UTC
  }
}

/**
 * Helper to get timezone offset in minutes
 */
function getTimezoneOffsetMinutes(timezone: string): number {
  const offsetMap: Record<string, number> = {
    'Asia/Kolkata': 330,      // +5:30
    'America/New_York': -300, // -5:00 (EST)
    'Europe/London': 0,       // GMT
    'UTC': 0
  };
  
  return offsetMap[timezone] || 0;
}

/**
 * Process a time range object to ensure dates are in proper format with timezone conversion
 */
export function processTimeRange(timeRange: any, userTimezone: string = 'UTC'): { startDate?: string; endDate?: string } {
  if (!timeRange) return {};
  
  console.log("Processing time range:", timeRange);
  console.log(`Using user timezone: ${userTimezone}`);
  
  const result: { startDate?: string; endDate?: string } = {};
  
  try {
    // Handle startDate if provided
    if (timeRange.startDate) {
      // Ensure it's a valid date
      const startDate = new Date(timeRange.startDate);
      if (!isNaN(startDate.getTime())) {
        result.startDate = startDate.toISOString();
      } else {
        console.warn(`Invalid startDate: ${timeRange.startDate}`);
      }
    }
    
    // Handle endDate if provided
    if (timeRange.endDate) {
      // Ensure it's a valid date
      const endDate = new Date(timeRange.endDate);
      if (!isNaN(endDate.getTime())) {
        result.endDate = endDate.toISOString();
      } else {
        console.warn(`Invalid endDate: ${timeRange.endDate}`);
      }
    }
    
    // Calculate current date in user's timezone
    const now = userTimezone ? toZonedTime(new Date(), userTimezone) : new Date();
    console.log(`Current date in timezone ${userTimezone}: ${now.toISOString()}`);
    
    // Handle special time range cases with proper timezone conversion
    if (timeRange.type === 'week') {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Week starts on Monday
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      
      // Convert to UTC for database query
      const { startDateUTC, endDateUTC } = convertLocalDateRangeToUTC(weekStart, weekEnd, userTimezone);
      result.startDate = startDateUTC;
      result.endDate = endDateUTC;
      
      console.log(`Generated 'this week' date range: ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'lastWeek') {
      console.log("CALCULATING LAST WEEK WITH TIMEZONE CONVERSION");
      // Get this week's Monday in user timezone
      const thisWeekMonday = startOfWeek(now, { weekStartsOn: 1 });
      
      // Last week's Monday is 7 days before this week's Monday
      const lastWeekMonday = subDays(thisWeekMonday, 7);
      
      // Last week's Sunday is 1 day before this week's Monday
      const lastWeekSunday = subDays(thisWeekMonday, 1);
      
      // Convert to UTC for database query
      const { startDateUTC, endDateUTC } = convertLocalDateRangeToUTC(lastWeekMonday, lastWeekSunday, userTimezone);
      result.startDate = startDateUTC;
      result.endDate = endDateUTC;
      
      console.log(`Generated 'last week' date range (UTC): ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'month') {
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      
      // Convert to UTC for database query
      const { startDateUTC, endDateUTC } = convertLocalDateRangeToUTC(monthStart, monthEnd, userTimezone);
      result.startDate = startDateUTC;
      result.endDate = endDateUTC;
      
      console.log(`Generated 'this month' date range (UTC): ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'lastMonth') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthStart = startOfMonth(lastMonth);
      const lastMonthEnd = endOfMonth(lastMonth);
      
      // Convert to UTC for database query
      const { startDateUTC, endDateUTC } = convertLocalDateRangeToUTC(lastMonthStart, lastMonthEnd, userTimezone);
      result.startDate = startDateUTC;
      result.endDate = endDateUTC;
      
      console.log(`Generated 'last month' date range (UTC): ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'specificMonth' && timeRange.monthName) {
      // Handle specific month by name with timezone conversion
      console.log(`Processing specific month: ${timeRange.monthName}`);
      processSpecificMonthByName(timeRange.monthName, result, timeRange.year, userTimezone);
      
      console.log(`Processed specific month name "${timeRange.monthName}" to UTC range: ${result.startDate} to ${result.endDate}`);
    }
    
    // Validate the resulting dates
    if (result.startDate && result.endDate) {
      const startDate = new Date(result.startDate);
      const endDate = new Date(result.endDate);
      
      if (startDate > endDate) {
        console.warn(`Invalid date range: startDate (${result.startDate}) is after endDate (${result.endDate})`);
        // Swap the dates
        const temp = result.startDate;
        result.startDate = result.endDate;
        result.endDate = temp;
      }
    }
    
    console.log("Final processed time range with UTC conversion:", result);
    return result;
  } catch (error) {
    console.error("Error processing time range:", error);
    return {};
  }
}

/**
 * Process a specific month by name with timezone conversion
 */
function processSpecificMonthByName(monthName: string, result: { startDate?: string; endDate?: string }, year?: number, userTimezone?: string) {
  const timezone = userTimezone || 'UTC';
  const now = timezone ? toZonedTime(new Date(), timezone) : new Date();
  const currentYear = now.getFullYear();
  const targetYear = year || currentYear;
  
  console.log(`Processing month ${monthName} for year ${targetYear} with timezone ${timezone}`);
  
  // Map of month names to their indices (0-based)
  const monthMap: Record<string, number> = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11
  };
  
  const normalizedMonthName = monthName.toLowerCase().trim();
  let monthIndex: number | undefined = undefined;
  
  // Find exact match for month name
  if (monthMap.hasOwnProperty(normalizedMonthName)) {
    monthIndex = monthMap[normalizedMonthName];
    console.log(`Found exact match for month name "${monthName}" -> index ${monthIndex}`);
  }
  
  if (monthIndex !== undefined) {
    // Create start and end dates for the specified month in user's timezone
    const monthStart = new Date(targetYear, monthIndex, 1);
    const monthEnd = new Date(targetYear, monthIndex + 1, 0, 23, 59, 59, 999);
    
    console.log(`Month range in local time: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`);
    
    // Convert to UTC for database query
    const { startDateUTC, endDateUTC } = convertLocalDateRangeToUTC(monthStart, monthEnd, timezone);
    result.startDate = startDateUTC;
    result.endDate = endDateUTC;
    
    console.log(`Generated UTC date range for ${monthName} ${targetYear}: ${result.startDate} to ${result.endDate}`);
  } else {
    console.warn(`Unknown month name: "${monthName}"`);
  }
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | string, formatStr: string = 'MMM d, yyyy'): string {
  try {
    if (typeof date === 'string') {
      date = parseISO(date);
    }
    return format(date, formatStr);
  } catch (error) {
    console.error("Error formatting date:", error);
    return String(date);
  }
}

/**
 * Convert a date to a specific timezone
 */
export function convertToTimezone(date: Date | string, timezone: string = 'UTC'): Date {
  try {
    if (typeof date === 'string') {
      date = parseISO(date);
    }
    
    // Use the correct toZonedTime function from date-fns-tz v3
    const result = toZonedTime(date, timezone);
    
    console.log(`Converted date to timezone ${timezone}:`, {
      inputDate: date instanceof Date ? date.toISOString() : date,
      outputDate: result.toISOString(),
      outputLocal: result.toString()
    });
    
    return result;
  } catch (error) {
    console.error("Error converting date to timezone:", error);
    return new Date(date);
  }
}
