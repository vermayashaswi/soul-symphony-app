
// Import all date functions directly from date-fns with specific version
import { format, parseISO, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'https://esm.sh/date-fns@4.1.0';

// Import timezone function using the new name in v3
import { toZonedTime } from 'https://esm.sh/date-fns-tz@3.2.0/esm/toZonedTime/index.js';

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
    } else if (timeRange.type === 'lastWeek') {
      const now = new Date();
      const lastWeek = subDays(now, 7);
      result.startDate = startOfWeek(lastWeek, { weekStartsOn: 1 }).toISOString();
      result.endDate = endOfWeek(lastWeek, { weekStartsOn: 1 }).toISOString();
    } else if (timeRange.type === 'month') {
      const now = new Date();
      result.startDate = startOfMonth(now).toISOString();
      result.endDate = endOfMonth(now).toISOString();
    } else if (timeRange.type === 'lastMonth') {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      result.startDate = startOfMonth(lastMonth).toISOString();
      result.endDate = endOfMonth(lastMonth).toISOString();
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
    return toZonedTime(date, timezone); // Updated to use toZonedTime instead of utcToZonedTime
  } catch (error) {
    console.error("Error converting date to timezone:", error);
    return new Date(date);
  }
}
