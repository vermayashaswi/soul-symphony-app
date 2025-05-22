
// Import all date functions directly from date-fns with specific version
import { format, parseISO, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'https://esm.sh/date-fns@4.1.0';

// Import timezone function using the correct import path for v3.2.0
import { toZonedTime } from 'https://esm.sh/date-fns-tz@3.2.0';

/**
 * Process a time range object to ensure dates are in proper format
 */
export function processTimeRange(timeRange: any): { startDate?: string; endDate?: string } {
  if (!timeRange) return {};
  
  console.log("Processing time range:", timeRange);
  
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
    
    // Handle special time range cases
    if (timeRange.type === 'week') {
      const now = new Date();
      result.startDate = startOfWeek(now, { weekStartsOn: 1 }).toISOString(); // Week starts on Monday
      result.endDate = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
      console.log(`Generated 'this week' date range: ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'lastWeek') {
      const now = new Date();
      // Get this week's Monday
      const thisWeekMonday = startOfWeek(now, { weekStartsOn: 1 });
      
      // Last week's Monday is 7 days before this week's Monday
      const lastWeekMonday = subDays(thisWeekMonday, 7);
      
      // Last week's Sunday is 1 day before this week's Monday
      const lastWeekSunday = subDays(thisWeekMonday, 1);
      
      // Log the calculation details for debugging
      console.log("Last week calculation details:");
      console.log(`Current date: ${now.toISOString()}`);
      console.log(`This week's Monday: ${thisWeekMonday.toISOString()}`);
      console.log(`Last week Monday: ${lastWeekMonday.toISOString()}`);
      console.log(`Last week Sunday: ${lastWeekSunday.toISOString()}`);
      
      result.startDate = startOfDay(lastWeekMonday).toISOString();
      result.endDate = endOfDay(lastWeekSunday).toISOString();
      console.log(`Generated 'last week' date range: ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'month') {
      const now = new Date();
      result.startDate = startOfMonth(now).toISOString();
      result.endDate = endOfMonth(now).toISOString();
      console.log(`Generated 'this month' date range: ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'lastMonth') {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      result.startDate = startOfMonth(lastMonth).toISOString();
      result.endDate = endOfMonth(lastMonth).toISOString();
      console.log(`Generated 'last month' date range: ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'specificMonth' && timeRange.monthName) {
      // Handle specific month by name (case insensitive)
      processSpecificMonthByName(timeRange.monthName, result, timeRange.year);
    }
    
    // Log timezone information for debugging
    const userTimezone = timeRange.timezone || 'UTC';
    console.log(`Time range processing using timezone: ${userTimezone}`);
    
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
    
    console.log("Processed time range:", result);
    return result;
  } catch (error) {
    console.error("Error processing time range:", error);
    return {};
  }
}

/**
 * Process a specific month by name
 */
function processSpecificMonthByName(monthName: string, result: { startDate?: string; endDate?: string }, year?: number) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const targetYear = year || currentYear;
  
  // Map of month names to their indices (0-based)
  const monthMap: Record<string, number> = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4, 'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11
  };
  
  const normalizedMonthName = monthName.toLowerCase();
  const monthIndex = monthMap[normalizedMonthName];
  
  if (monthIndex !== undefined) {
    // Create start and end dates for the specified month
    const startDate = new Date(targetYear, monthIndex, 1);
    const endDate = new Date(targetYear, monthIndex + 1, 0); // Last day of month
    
    result.startDate = startOfDay(startDate).toISOString();
    result.endDate = endOfDay(endDate).toISOString();
    
    console.log(`Generated date range for ${monthName} ${targetYear}: ${result.startDate} to ${result.endDate}`);
  } else {
    console.warn(`Unknown month name: ${monthName}`);
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
    const result = toZonedTime(date, timezone); // Using toZonedTime from date-fns-tz v3
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
