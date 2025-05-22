
/**
 * Unified Date Service
 * 
 * This service provides a single source of truth for all date-related operations
 * in the application. It handles timezone conversions, date calculations, and
 * formatting consistently across both client and server environments.
 */

import { 
  addDays, 
  subDays, 
  startOfWeek, 
  endOfWeek, 
  startOfDay, 
  endOfDay,
  format as formatDate
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
 * Gets the current client time information
 * @returns ClientTimeInfo object with current client time details
 */
export function getClientTimeInfo(): ClientTimeInfo {
  return {
    timestamp: new Date().toISOString(),
    timezoneName: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    timezoneOffset: new Date().getTimezoneOffset()
  };
}

/**
 * Logs detailed information about a date calculation
 * @param operation - The operation being performed
 * @param input - Input date or parameters
 * @param output - Result of the operation
 * @param additionalInfo - Any additional context
 */
export function logDateOperation(
  operation: string,
  input: any,
  output: any,
  additionalInfo: Record<string, any> = {}
): void {
  console.log(
    `[DateService] ${operation}:`,
    {
      input,
      output,
      currentServerTime: new Date().toISOString(),
      ...additionalInfo
    }
  );
}

/**
 * Gets a specific timezone-aware date
 * @param date - Date to convert (defaults to now)
 * @param timezone - Target timezone (defaults to UTC)
 * @returns Date object in the specified timezone
 */
export function getZonedDate(
  date: Date | string = new Date(),
  timezone: string = 'UTC'
): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return toZonedTime(dateObj, timezone);
}

/**
 * Format a date in a specific timezone
 * @param date - Date to format
 * @param formatStr - Format string
 * @param timezone - Target timezone
 * @returns Formatted date string
 */
export function formatInTimezone(
  date: Date | string,
  formatStr: string = 'yyyy-MM-dd HH:mm:ss',
  timezone: string = 'UTC'
): string {
  return formatInTimeZone(
    typeof date === 'string' ? new Date(date) : date,
    timezone,
    formatStr
  );
}

/**
 * Gets the dates for the current week in a specific timezone
 * @param clientTimeInfo - Client time information
 * @param userTimezone - User's preferred timezone from their profile (fallback)
 * @returns Formatted string with the current week's date range
 */
export function getCurrentWeekDateRange(
  clientTimeInfo?: Partial<ClientTimeInfo>,
  userTimezone?: string
): { formattedRange: string; rangeObj: DateRange } {
  // Determine the most appropriate timezone to use
  const timezone = (clientTimeInfo?.timezoneName || userTimezone || getUserTimezoneName() || 'UTC');
  
  // Get reference time (prefer client's time over server time)
  const referenceTime = clientTimeInfo?.timestamp ? new Date(clientTimeInfo.timestamp) : new Date();
  
  console.log(`[DateService] Getting current week dates for timezone: ${timezone}`);
  console.log(`[DateService] Using reference time: ${referenceTime.toISOString()}`);
  
  // Get the current date in the user's timezone
  const zonedNow = getZonedDate(referenceTime, timezone);
  
  // Get the start of the week (Monday) and end of the week (Sunday)
  const startOfCurrentWeek = startOfWeek(zonedNow, { weekStartsOn: 1 });
  const endOfCurrentWeek = endOfWeek(zonedNow, { weekStartsOn: 1 });
  
  // Log detailed information
  console.log(`[DateService] Current date in timezone (${timezone}): ${formatDate(zonedNow, 'yyyy-MM-dd HH:mm:ss')}`);
  console.log(`[DateService] Start of current week: ${formatDate(startOfCurrentWeek, 'yyyy-MM-dd')} (${startOfCurrentWeek.toISOString()})`);
  console.log(`[DateService] End of current week: ${formatDate(endOfCurrentWeek, 'yyyy-MM-dd')} (${endOfCurrentWeek.toISOString()})`);
  
  // Format the dates in a user-friendly way
  const formattedStart = formatDate(startOfCurrentWeek, 'MMMM d');
  const formattedEnd = formatDate(endOfCurrentWeek, 'MMMM d, yyyy');
  const formattedRange = `${formattedStart} to ${formattedEnd}`;

  // Create date range object with ISO strings for exact calculations
  const rangeObj: DateRange = {
    startDate: startOfCurrentWeek.toISOString(),
    endDate: endOfCurrentWeek.toISOString(),
    periodName: 'this week'
  };
  
  console.log(`[DateService] Formatted current week: ${formattedRange}`);
  
  return { formattedRange, rangeObj };
}

/**
 * Gets the dates for the last week in a specific timezone
 * 
 * "Last week" is defined as the previous calendar week (Monday-Sunday)
 * 
 * @param clientTimeInfo - Client time information
 * @param userTimezone - User's preferred timezone from their profile (fallback)
 * @returns Formatted string with the last week's date range and range object
 */
export function getLastWeekDateRange(
  clientTimeInfo?: Partial<ClientTimeInfo>,
  userTimezone?: string
): { formattedRange: string; rangeObj: DateRange } {
  // Determine the most appropriate timezone to use
  const timezone = (clientTimeInfo?.timezoneName || userTimezone || getUserTimezoneName() || 'UTC');
  
  // Get reference time (prefer client's time over server time)
  const referenceTime = clientTimeInfo?.timestamp ? new Date(clientTimeInfo.timestamp) : new Date();
  
  console.log(`[DateService] Getting last week dates for timezone: ${timezone}`);
  console.log(`[DateService] Using reference time: ${referenceTime.toISOString()}`);
  
  // Get the current date in the user's timezone
  const zonedNow = getZonedDate(referenceTime, timezone);
  
  // Get this week's Monday (start of current week)
  const thisWeekMonday = startOfWeek(zonedNow, { weekStartsOn: 1 });
  
  // Last week's Monday is 7 days before this week's Monday
  const lastWeekMonday = subDays(thisWeekMonday, 7);
  
  // Last week's Sunday is 1 day before this week's Monday
  const lastWeekSunday = subDays(thisWeekMonday, 1);
  
  // Log detailed calculation information
  console.log("[DateService] LAST WEEK CALCULATION:");
  console.log(`[DateService] Current date: ${formatDate(zonedNow, 'yyyy-MM-dd')} (${zonedNow.toISOString()})`);
  console.log(`[DateService] This week's Monday: ${formatDate(thisWeekMonday, 'yyyy-MM-dd')} (${thisWeekMonday.toISOString()})`);
  console.log(`[DateService] Last week's Monday: ${formatDate(lastWeekMonday, 'yyyy-MM-dd')} (${lastWeekMonday.toISOString()})`);
  console.log(`[DateService] Last week's Sunday: ${formatDate(lastWeekSunday, 'yyyy-MM-dd')} (${lastWeekSunday.toISOString()})`);
  
  // Ensure we have the start and end of day
  const lastWeekStart = startOfDay(lastWeekMonday);
  const lastWeekEnd = endOfDay(lastWeekSunday);
  
  // Format the dates in a user-friendly way
  const formattedStart = formatDate(lastWeekStart, 'MMMM d');
  const formattedEnd = formatDate(lastWeekEnd, 'MMMM d, yyyy');
  const formattedRange = `${formattedStart} to ${formattedEnd}`;
  
  // Create date range object with ISO strings
  const rangeObj: DateRange = {
    startDate: lastWeekStart.toISOString(),
    endDate: lastWeekEnd.toISOString(),
    periodName: 'last week'
  };
  
  console.log(`[DateService] Formatted last week: ${formattedRange}`);
  
  return { formattedRange, rangeObj };
}

/**
 * Calculates a date range based on a time period expression
 * @param timePeriod - Time period expression (e.g., "last week", "this month")
 * @param clientTimeInfo - Client time information 
 * @param userTimezone - User's timezone from their profile
 * @returns Date range with start and end dates
 */
export function calculateDateRange(
  timePeriod: string,
  clientTimeInfo?: Partial<ClientTimeInfo>,
  userTimezone?: string
): DateRange {
  // Determine timezone to use (in order of priority)
  const timezone = clientTimeInfo?.timezoneName || userTimezone || getUserTimezoneName() || 'UTC';
  
  // Get reference time (prefer client time over server time)
  const referenceTime = clientTimeInfo?.timestamp ? new Date(clientTimeInfo.timestamp) : new Date();
  
  console.log(`[DateService] Calculating date range for "${timePeriod}" with timezone ${timezone}`);
  console.log(`[DateService] Using reference time: ${referenceTime.toISOString()}`);
  
  // Get the date in the user's timezone
  const zonedDate = getZonedDate(referenceTime, timezone);
  console.log(`[DateService] Reference date in timezone: ${formatDate(zonedDate, 'yyyy-MM-dd HH:mm:ss')}`);
  
  let startDate: Date;
  let endDate: Date;
  let periodName = timePeriod;
  
  // Normalize time period for better matching
  const lowerTimePeriod = timePeriod.toLowerCase().trim();
  
  // Special case handling for "last week" to ensure consistent behavior
  if (lowerTimePeriod === 'last week') {
    const lastWeek = getLastWeekDateRange({ timestamp: referenceTime.toISOString(), timezoneName: timezone }, userTimezone);
    return lastWeek.rangeObj;
  }
  
  // Special case handling for "this week" to ensure consistent behavior
  if (lowerTimePeriod === 'this week') {
    const currentWeek = getCurrentWeekDateRange({ timestamp: referenceTime.toISOString(), timezoneName: timezone }, userTimezone);
    return currentWeek.rangeObj;
  }
  
  // Handle other common time periods
  if (lowerTimePeriod === 'today') {
    startDate = startOfDay(zonedDate);
    endDate = endOfDay(zonedDate);
    periodName = 'today';
  } 
  else if (lowerTimePeriod === 'yesterday') {
    startDate = startOfDay(subDays(zonedDate, 1));
    endDate = endOfDay(subDays(zonedDate, 1));
    periodName = 'yesterday';
  }
  else if (lowerTimePeriod.match(/last (\d+) days?/)) {
    const matches = lowerTimePeriod.match(/last (\d+) days?/);
    const days = parseInt(matches![1], 10) || 7;
    startDate = startOfDay(subDays(zonedDate, days));
    endDate = endOfDay(zonedDate);
    periodName = `last ${days} days`;
  }
  else {
    // Default to last 7 days if no specific period matched
    startDate = startOfDay(subDays(zonedDate, 7));
    endDate = endOfDay(zonedDate);
    periodName = 'last 7 days';
  }
  
  // Log the calculated dates
  console.log(`[DateService] Period: ${periodName}`);
  console.log(`[DateService] Start date: ${formatDate(startDate, 'yyyy-MM-dd HH:mm:ss')} (${startDate.toISOString()})`);
  console.log(`[DateService] End date: ${formatDate(endDate, 'yyyy-MM-dd HH:mm:ss')} (${endDate.toISOString()})`);
  
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    periodName
  };
}

/**
 * Gets the user's current timezone offset in minutes
 */
export function getUserTimezoneOffset(): number {
  return new Date().getTimezoneOffset();
}

/**
 * Gets the user's timezone name
 */
export function getUserTimezoneName(): string | undefined {
  try {
    const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log(`[DateService] Detected user timezone: ${timezoneName}`);
    return timezoneName;
  } catch (e) {
    console.error("[DateService] Unable to get user timezone name:", e);
    return undefined;
  }
}

/**
 * Check if a query is asking about dates like "what day is today" or "what's the current week"
 * @param message - User's query
 * @returns boolean indicating if this is a direct date query
 */
export function isDirectDateQuery(message: string): boolean {
  const lowerQuery = message.toLowerCase();
  
  // Patterns for direct date inquiries
  const dateQueryPatterns = [
    /\bwhat\s+(is|are)\s+(the\s+)?(current|this)\s+week('s)?\s+dates\b/i,
    /\bwhat\s+date\s+is\s+it\b/i,
    /\bwhat\s+day\s+is\s+(it|today)\b/i,
    /\bwhat\s+(is|are)\s+(the\s+)?dates?\s+for\s+(this|current|last|previous)\s+week\b/i,
    /\bcurrent\s+week\s+dates?\b/i,
    /\blast\s+week\s+dates?\b/i,
    /\blast\s+week('s)?\s+dates?\b/i,
    /\bthis\s+week('s)?\s+dates?\b/i, 
    /\bwhat\s+dates?\s+(is|are)\s+(this|last)\s+week\b/i,
    /\btoday's\s+date\b/i
  ];
  
  // Check if any of the patterns match
  for (const pattern of dateQueryPatterns) {
    if (pattern.test(lowerQuery)) {
      console.log(`[DateService] Direct date query detected with pattern: ${pattern}`);
      return true;
    }
  }
  
  console.log("[DateService] Not a direct date query");
  return false;
}

/**
 * Debug helper that logs detailed timezone information
 */
export function debugTimezoneInfo(): void {
  const offset = getUserTimezoneOffset();
  const timezoneName = getUserTimezoneName();
  const now = new Date();
  
  console.log("[DateService] Timezone Debug Information:");
  console.log(`[DateService] Current date (local): ${now.toString()}`);
  console.log(`[DateService] Current date (ISO): ${now.toISOString()}`);
  console.log(`[DateService] Timezone offset: ${offset} minutes`);
  console.log(`[DateService] Timezone name: ${timezoneName || "unknown"}`);
  
  // Test date calculations
  console.log("\n[DateService] Date Calculation Tests:");
  
  // Test "current week" calculation
  const currentWeek = getCurrentWeekDateRange();
  console.log(`[DateService] Current week dates: ${currentWeek.formattedRange}`);
  
  // Test "last week" calculation
  const lastWeek = getLastWeekDateRange();
  console.log(`[DateService] Last week dates: ${lastWeek.formattedRange}`);
}
