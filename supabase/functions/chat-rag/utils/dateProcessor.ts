
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
    // Use timezone from the timeRange object if available
    const timezone = timeRange.timezone || 'UTC';
    console.log(`Using timezone for date processing: ${timezone}`);
    
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
    const now = timezone ? toZonedTime(new Date(), timezone) : new Date();
    console.log(`Current date in timezone ${timezone}: ${now.toISOString()}`);
    
    // Handle special time range cases
    if (timeRange.type === 'week') {
      result.startDate = startOfWeek(now, { weekStartsOn: 1 }).toISOString(); // Week starts on Monday
      result.endDate = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
      console.log(`Generated 'this week' date range: ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'lastWeek') {
      console.log("CALCULATING LAST WEEK");
      // Get this week's Monday in user timezone
      const thisWeekMonday = startOfWeek(now, { weekStartsOn: 1 });
      
      // Last week's Monday is 7 days before this week's Monday
      const lastWeekMonday = subDays(thisWeekMonday, 7);
      
      // Last week's Sunday is 1 day before this week's Monday
      const lastWeekSunday = subDays(thisWeekMonday, 1);
      
      // Log detailed calculation for debugging
      console.log("LAST WEEK CALCULATION DETAILED DEBUG:");
      console.log(`Current date in timezone ${timezone}: ${now.toISOString()}`);
      console.log(`This week's Monday: ${thisWeekMonday.toISOString()}`);
      console.log(`Last week's Monday: ${lastWeekMonday.toISOString()}`);
      console.log(`Last week's Sunday: ${lastWeekSunday.toISOString()}`);
      
      result.startDate = startOfDay(lastWeekMonday).toISOString();
      result.endDate = endOfDay(lastWeekSunday).toISOString();
      console.log(`Generated 'last week' date range: ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'month') {
      result.startDate = startOfMonth(now).toISOString();
      result.endDate = endOfMonth(now).toISOString();
      console.log(`Generated 'this month' date range: ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'lastMonth') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      result.startDate = startOfMonth(lastMonth).toISOString();
      result.endDate = endOfMonth(lastMonth).toISOString();
      console.log(`Generated 'last month' date range: ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'specificMonth' && timeRange.monthName) {
      // Handle specific month by name and add detailed logs
      console.log(`Processing specific month: ${timeRange.monthName}`);
      processSpecificMonthByName(timeRange.monthName, result, timeRange.year, timezone);
      
      // Add additional logging for month name processing
      console.log(`Processed specific month name "${timeRange.monthName}" to date range: ${result.startDate} to ${result.endDate}`);
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
function processSpecificMonthByName(monthName: string, result: { startDate?: string; endDate?: string }, year?: number, timezone?: string) {
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
  
  // Special handling for "may" which can be ambiguous
  const normalizedMonthName = monthName.toLowerCase().trim();
  let monthIndex: number | undefined = undefined;
  
  // First look for exact matches
  if (monthMap.hasOwnProperty(normalizedMonthName)) {
    monthIndex = monthMap[normalizedMonthName];
    console.log(`Found exact match for month name "${monthName}" -> index ${monthIndex}`);
  }
  
  // If we still don't have a valid month index, look for partial matches
  if (monthIndex === undefined) {
    // This should never happen with our current implementation, but adding as a fallback
    for (const [key, index] of Object.entries(monthMap)) {
      if (key.includes(normalizedMonthName) || normalizedMonthName.includes(key)) {
        console.log(`Found partial match for month "${monthName}" with "${key}"`);
        monthIndex = index;
        break;
      }
    }
  }
  
  if (monthIndex !== undefined) {
    // Create start and end dates for the specified month
    let startDate: Date;
    let endDate: Date;
    
    if (timezone) {
      // Use timezone-aware date object
      const timezonedDate = toZonedTime(new Date(targetYear, monthIndex, 1), timezone);
      startDate = startOfMonth(timezonedDate);
      endDate = endOfMonth(timezonedDate);
    } else {
      startDate = startOfMonth(new Date(targetYear, monthIndex, 1));
      endDate = endOfMonth(new Date(targetYear, monthIndex, 1));
    }
    
    result.startDate = startOfDay(startDate).toISOString();
    result.endDate = endOfDay(endDate).toISOString();
    
    console.log(`Generated date range for ${monthName} ${targetYear}: ${result.startDate} to ${result.endDate}`);
    console.log(`Month calculation details:`, {
      monthName,
      monthIndex,
      year: targetYear,
      timezone,
      startDateISO: result.startDate,
      endDateISO: result.endDate,
      startDateLocal: new Date(result.startDate).toString(),
      endDateLocal: new Date(result.endDate).toString()
    });
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
