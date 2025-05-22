import { addDays, endOfDay, endOfMonth, endOfWeek, endOfYear, startOfDay, startOfMonth, startOfWeek, startOfYear, subDays, subMonths, subWeeks, subYears } from "date-fns";
import { format, formatInTimeZone, toZonedTime } from "date-fns-tz";

/**
 * Get the formatted date range for the current week
 * @returns Formatted string with the current week's date range
 */
export function getCurrentWeekDates(timezone?: string): string {
  const tz = timezone || getUserTimezoneName() || 'UTC';
  console.log(`Getting current week dates for timezone: ${tz}`);
  
  // Get the current date in the user's timezone
  const now = new Date();
  const zonedNow = toZonedTime(now, tz);
  
  console.log(`Current date (UTC): ${now.toISOString()}`);
  console.log(`Current date in timezone (${tz}): ${format(zonedNow, 'yyyy-MM-dd HH:mm:ss')}`);
  
  // Get the start of the week (Monday)
  const startOfCurrentWeek = startOfWeek(zonedNow, { weekStartsOn: 1 });
  // Get the end of the week (Sunday)
  const endOfCurrentWeek = endOfWeek(zonedNow, { weekStartsOn: 1 });
  
  console.log(`Start of current week: ${format(startOfCurrentWeek, 'yyyy-MM-dd')} (${startOfCurrentWeek.toISOString()})`);
  console.log(`End of current week: ${format(endOfCurrentWeek, 'yyyy-MM-dd')} (${endOfCurrentWeek.toISOString()})`);
  
  // Format the dates in a user-friendly way
  const formattedStart = format(startOfCurrentWeek, 'MMMM d');
  const formattedEnd = format(endOfCurrentWeek, 'MMMM d, yyyy');

  const result = `${formattedStart} to ${formattedEnd}`;
  console.log(`Formatted current week: ${result}`);
  return result;
}

/**
 * Get the formatted date range for the last week
 * @returns Formatted string with the last week's date range
 */
export function getLastWeekDates(timezone?: string): string {
  const tz = timezone || getUserTimezoneName() || 'UTC';
  console.log(`Getting last week dates for timezone: ${tz}`);
  
  // IMPORTANT: Always create a fresh date object
  const now = new Date();
  console.log(`Using fresh date object for calculation: ${now.toISOString()}`);
  
  // Get the current date in the user's timezone
  const zonedNow = toZonedTime(now, tz);
  console.log(`Current date in timezone (${tz}): ${format(zonedNow, 'yyyy-MM-dd HH:mm:ss')} (${zonedNow.toISOString()})`);
  
  // Get this week's Monday (start of current week)
  const thisWeekMonday = startOfWeek(zonedNow, { weekStartsOn: 1 });
  console.log(`This week's Monday: ${format(thisWeekMonday, 'yyyy-MM-dd')} (${thisWeekMonday.toISOString()})`);
  
  // Last week's Monday is 7 days before this week's Monday
  const lastWeekMonday = subDays(thisWeekMonday, 7);
  console.log(`Last week's Monday: ${format(lastWeekMonday, 'yyyy-MM-dd')} (${lastWeekMonday.toISOString()})`);
  
  // Last week's Sunday is 1 day before this week's Monday
  const lastWeekSunday = subDays(thisWeekMonday, 1);
  console.log(`Last week's Sunday: ${format(lastWeekSunday, 'yyyy-MM-dd')} (${lastWeekSunday.toISOString()})`);
  
  // Format the dates in a user-friendly way
  const formattedStart = format(lastWeekMonday, 'MMMM d');
  const formattedEnd = format(lastWeekSunday, 'MMMM d, yyyy');

  const result = `${formattedStart} to ${formattedEnd}`;
  console.log(`Formatted last week: ${result}`);
  return result;
}

/**
 * Calculates relative date ranges based on time expressions
 * @param timePeriod - The time period expression (e.g., "this month", "last week")
 * @param timezoneOffset - User's timezone offset in minutes
 * @param referenceDate - Optional reference date for relative calculations
 * @param clientTimestamp - Optional client device timestamp for reference
 * @param userTimezone - Optional user timezone from profile
 * @returns Date range with start and end dates
 */
export function calculateRelativeDateRange(
  timePeriod: string, 
  timezoneOffset: number = 0,
  referenceDate?: Date,
  clientTimestamp?: string,
  userTimezone?: string
): { startDate: string, endDate: string, periodName: string } {
  // Convert timezone offset to milliseconds
  const offsetMs = timezoneOffset * 60 * 1000;
  
  // Get timezone name if available
  const timezoneName = userTimezone || getUserTimezoneName() || 'UTC';
  
  // Use provided reference time or get current date in user's timezone
  let now;
  if (clientTimestamp) {
    // Use the client's device time if provided
    now = toZonedTime(new Date(clientTimestamp), timezoneName);
    console.log(`Using client's timestamp: ${clientTimestamp} in timezone ${timezoneName}`);
  } else if (referenceDate) { 
    // Use provided reference date
    now = toZonedTime(new Date(referenceDate), timezoneName);
  } else {
    // Use current server time (last resort)
    now = toZonedTime(new Date(), timezoneName);
  }
    
  let startDate: Date;
  let endDate: Date;
  let periodName = timePeriod;
  
  console.log(`Calculating date range for "${timePeriod}" with timezone ${timezoneName}`);
  console.log(`Using reference date: ${format(now, 'yyyy-MM-dd HH:mm:ss')} (${now.toISOString()})`);
  console.log(`Day of week: ${now.getDay()}, Date: ${now.getDate()}, Month: ${now.getMonth() + 1}, Year: ${now.getFullYear()}`);
  
  // Normalize time period for better matching
  const lowerTimePeriod = timePeriod.toLowerCase().trim();
  
  // Enhanced pattern matching with more variations
  if (lowerTimePeriod.includes('today') || lowerTimePeriod.includes('this day')) {
    // Today: Start at midnight, end at 23:59:59
    startDate = startOfDay(now);
    endDate = endOfDay(now);
    periodName = 'today';
  } 
  else if (lowerTimePeriod.includes('yesterday')) {
    // Yesterday: Start at previous day midnight, end at previous day 23:59:59
    startDate = startOfDay(subDays(now, 1));
    endDate = endOfDay(subDays(now, 1));
    periodName = 'yesterday';
  }
  else if (lowerTimePeriod.match(/past (\d+) days?/)) {
    // Past X days: Start X days ago at midnight, end at today 23:59:59
    const matches = lowerTimePeriod.match(/past (\d+) days?/);
    const days = parseInt(matches![1], 10) || 7; // Default to 7 if parsing fails
    startDate = startOfDay(subDays(now, days));
    endDate = endOfDay(now);
    periodName = `past ${days} days`;
  }
  else if (lowerTimePeriod.match(/last (\d+) days?/)) {
    // Last X days: Start X days ago at midnight, end at today 23:59:59
    const matches = lowerTimePeriod.match(/last (\d+) days?/);
    const days = parseInt(matches![1], 10) || 7; // Default to 7 if parsing fails
    startDate = startOfDay(subDays(now, days));
    endDate = endOfDay(now);
    periodName = `last ${days} days`;
  }
  else if (lowerTimePeriod.match(/recent (\d+) days?/)) {
    // Recent X days: Start X days ago at midnight, end at today 23:59:59
    const matches = lowerTimePeriod.match(/recent (\d+) days?/);
    const days = parseInt(matches![1], 10) || 7; // Default to 7 if parsing fails
    startDate = startOfDay(subDays(now, days));
    endDate = endOfDay(now);
    periodName = `recent ${days} days`;
  }
  else if (lowerTimePeriod.includes('this week')) {
    // This week: Start at current week Monday, end at Sunday 23:59:59
    startDate = startOfWeek(now, { weekStartsOn: 1 }); // Start on Monday
    endDate = endOfWeek(now, { weekStartsOn: 1 }); // End on Sunday
    periodName = 'this week';
  } 
  else if (lowerTimePeriod.includes('last week')) {
    // FIXED: Properly calculate last calendar week
    
    // Get this week's Monday and Sunday
    const thisWeekMonday = startOfWeek(now, { weekStartsOn: 1 });
    const thisWeekSunday = endOfWeek(now, { weekStartsOn: 1 });
    
    // Last week is 7 days before this week
    const lastWeekMonday = subDays(thisWeekMonday, 7);
    const lastWeekSunday = subDays(thisWeekMonday, 1);
    
    console.log("LAST WEEK CALCULATION (NEW METHOD):");
    console.log(`Current date: ${format(now, 'yyyy-MM-dd')}`);
    console.log(`This week's Monday: ${format(thisWeekMonday, 'yyyy-MM-dd')}`);
    console.log(`This week's Sunday: ${format(thisWeekSunday, 'yyyy-MM-dd')}`);
    console.log(`Last week's Monday: ${format(lastWeekMonday, 'yyyy-MM-dd')}`);
    console.log(`Last week's Sunday: ${format(lastWeekSunday, 'yyyy-MM-dd')}`);
    
    startDate = startOfDay(lastWeekMonday);
    endDate = endOfDay(lastWeekSunday);
    periodName = 'last week';
  }
  else if (lowerTimePeriod.includes('past week') || lowerTimePeriod.includes('previous week')) {
    // Past/previous week: Start at 7 days ago, end at today
    startDate = startOfDay(subDays(now, 7));
    endDate = endOfDay(now);
    periodName = 'past week';
  }
  else if (lowerTimePeriod.includes('this month')) {
    // This month: Start at 1st of current month, end at last day of month 23:59:59
    startDate = startOfMonth(now);
    endDate = endOfMonth(now);
    periodName = 'this month';
  } 
  else if (lowerTimePeriod.includes('last month') || lowerTimePeriod === 'previous month') {
    // Last month: Start at 1st of previous month, end at last day of previous month 23:59:59
    const prevMonth = subMonths(now, 1);
    startDate = startOfMonth(prevMonth);
    endDate = endOfMonth(prevMonth);
    periodName = 'last month';
  }
  else if (lowerTimePeriod.includes('past month')) {
    // Past month: Start at 30 days ago, end at today
    startDate = startOfDay(subDays(now, 30));
    endDate = endOfDay(now);
    periodName = 'past month';
  }
  else if (lowerTimePeriod.includes('this year')) {
    // This year: Start at January 1st, end at December 31st 23:59:59
    startDate = startOfYear(now);
    endDate = endOfYear(now);
    periodName = 'this year';
  } 
  else if (lowerTimePeriod.includes('last year')) {
    // Last year: Start at January 1st of previous year, end at December 31st of previous year 23:59:59
    const prevYear = subYears(now, 1);
    startDate = startOfYear(prevYear);
    endDate = endOfYear(prevYear);
    periodName = 'last year';
  } 
  else if (lowerTimePeriod === 'entire' || lowerTimePeriod === 'all' || 
           lowerTimePeriod === 'everything' || lowerTimePeriod === 'overall' ||
           lowerTimePeriod === 'all time' || lowerTimePeriod === 'always' ||
           lowerTimePeriod === 'all my entries' || lowerTimePeriod === 'all entries') {
    // Special case for "entire" - use a very broad date range (5 years back)
    startDate = startOfYear(subYears(now, 5));
    endDate = endOfDay(now);
    periodName = 'all time';
  }
  else if (lowerTimePeriod === 'yes' || lowerTimePeriod === 'sure' || 
           lowerTimePeriod === 'ok' || lowerTimePeriod === 'okay' ||
           lowerTimePeriod === 'yep' || lowerTimePeriod === 'yeah') {
    // Special handling for affirmative responses - use a broad date range
    startDate = startOfYear(subYears(now, 5));
    endDate = endOfDay(now);
    periodName = 'all time'; // Use "all time" for affirmative responses
  }
  else {
    // Default to last 30 days if no specific period matched
    startDate = startOfDay(subDays(now, 30));
    endDate = endOfDay(now);
    periodName = 'last 30 days';
  }

  // Format dates as ISO strings
  const isoStartDate = startDate.toISOString();
  const isoEndDate = endDate.toISOString();
  
  // Log date calculation details for debugging
  console.log("Date calculation details:");
  console.log(`Period: ${periodName}`);
  console.log(`Start date: ${format(startDate, 'yyyy-MM-dd HH:mm:ss')} (${isoStartDate})`);
  console.log(`End date: ${format(endDate, 'yyyy-MM-dd HH:mm:ss')} (${isoEndDate})`);
  console.log(`Duration in days: ${Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))}`);
  
  // Validate the date range
  if (endDate < startDate) {
    console.error("Invalid date range calculated: end date is before start date");
    // Fallback to last 7 days as a safe default
    const fallbackStart = startOfDay(subDays(now, 7));
    const fallbackEnd = endOfDay(now);
    return {
      startDate: fallbackStart.toISOString(),
      endDate: fallbackEnd.toISOString(),
      periodName: 'last 7 days (fallback)'
    };
  }
  
  return {
    startDate: isoStartDate,
    endDate: isoEndDate,
    periodName
  };
}

/**
 * Detects relative time expressions in a query
 * @param query - The user's message
 * @returns string containing the detected time period or null if none found
 */
export function detectRelativeTimeExpression(query: string): string | null {
  if (!query) return null;
  
  const lowerQuery = query.toLowerCase().trim();
  
  // Common time period expressions
  const timePeriodPatterns = [
    /\btoday\b/,
    /\byesterday\b/,
    /\bthis\s+(day|week|month|year)\b/,
    /\blast\s+(day|week|month|year|(\d+)\s+days?|(\d+)\s+weeks?|(\d+)\s+months?|(\d+)\s+years?)\b/,
    /\b(recent|past|previous)\s+(day|week|month|year|(\d+)\s+days?|(\d+)\s+weeks?|(\d+)\s+months?|(\d+)\s+years?)\b/,
    /\ball(\s+time)?\b/,
    /\bentire\b/,
    /\beverything\b/,
    /\boverall\b/
  ];
  
  // Check for time expressions in the query
  for (const pattern of timePeriodPatterns) {
    const match = lowerQuery.match(pattern);
    if (match) {
      // Return the matched time expression
      return match[0];
    }
  }
  
  // Special case for simple query like "last month?" or "what about last year?"
  if (/^(what\s+about\s+)?(the\s+)?(last|this|previous|past|recent)\s+(day|week|month|year|(\d+)\s+days?|(\d+)\s+weeks?|(\d+)\s+months?|(\d+)\s+years?)(\?|\.|$)/i.test(lowerQuery)) {
    const match = lowerQuery.match(/(last|this|previous|past|recent)\s+(day|week|month|year|(\d+)\s+days?|(\d+)\s+weeks?|(\d+)\s+months?|(\d+)\s+years?)/i);
    if (match) return match[0];
  }
  
  return null;
}

/**
 * Extracts a reference date from a previous query plan
 * @param previousDateRange - The previous date range with date
 * @returns Date object or undefined if no reference date found
 */
export function extractReferenceDate(previousDateRange: any): Date | undefined {
  if (!previousDateRange || !previousDateRange.endDate) {
    return undefined;
  }
  
  // Use the end date of the previous date range as reference
  try {
    const referenceDate = new Date(previousDateRange.endDate);
    if (isNaN(referenceDate.getTime())) {
      return undefined;
    }
    return referenceDate;
  } catch (error) {
    console.error("Error extracting reference date:", error);
    return undefined;
  }
}

/**
 * Determines if a query is asking about a relative time period compared to a previous context
 * @param query - The user's query
 * @returns boolean indicating if this is a relative time query
 */
export function isRelativeTimeQuery(query: string): boolean {
  if (!query) return false;
  
  const lowerQuery = query.toLowerCase().trim();
  
  // Check for patterns like "what about last month" or "show me last week"
  const relativeTimePatterns = [
    /^(what|how) about (last|this|previous|past|recent)/i,
    /^(show|tell|give) me (last|this|previous|past|recent)/i,
    /^(and|or|but) (last|this|previous|past|recent)/i,
    /^(last|this|previous|past|recent)/i
  ];
  
  for (const pattern of relativeTimePatterns) {
    if (pattern.test(lowerQuery)) {
      return true;
    }
  }
  
  // Also check for standalone time periods that could be follow-ups
  if (/^(today|yesterday|this week|last week|this month|last month|this year|last year)(\?|\.|$)/i.test(lowerQuery)) {
    return true;
  }
  
  return false;
}

/**
 * Get the user's current timezone offset
 * @returns User's timezone offset in minutes
 */
export function getUserTimezoneOffset(): number {
  return new Date().getTimezoneOffset();
}

/**
 * Get the user's timezone name if available
 * @returns User's timezone name or undefined
 */
export function getUserTimezoneName(): string | undefined {
  try {
    const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log(`Detected user timezone: ${timezoneName}`);
    return timezoneName;
  } catch (e) {
    console.error("Unable to get user timezone name:", e);
    return undefined;
  }
}

/**
 * Debug helper to log timezone information
 */
export function debugTimezoneInfo(): void {
  const offset = getUserTimezoneOffset();
  const timezoneName = getUserTimezoneName();
  const now = new Date();
  
  console.log("Timezone Debug Information:");
  console.log(`Current date (local): ${now.toString()}`);
  console.log(`Current date (ISO): ${now.toISOString()}`);
  console.log(`Timezone offset: ${offset} minutes`);
  console.log(`Timezone name: ${timezoneName || "unknown"}`);
  console.log(`Local time: ${now.toLocaleTimeString()}`);
  
  // Additional debugging for specific dates
  console.log("\nDate Calculation Tests:");
  
  // Test "current week" calculation
  console.log("Testing 'current week' calculation:");
  const currentWeek = getCurrentWeekDates();
  console.log(`Current week dates: ${currentWeek}`);
  
  // Test "last week" calculation using both methods
  console.log("Testing 'last week' calculation:");
  const lastWeekDates = getLastWeekDates();
  console.log(`Last week dates (direct function): ${lastWeekDates}`);
  
  const lastWeekTest = calculateRelativeDateRange("last week");
  console.log(`"last week" calculation via calculateRelativeDateRange:`, lastWeekTest);
  
  // Parse the ISO dates for clearer output
  const startDate = new Date(lastWeekTest.startDate);
  const endDate = new Date(lastWeekTest.endDate);
  
  console.log(`Last week start: ${format(startDate, 'yyyy-MM-dd')} (${startDate.toDateString()})`);
  console.log(`Last week end: ${format(endDate, 'yyyy-MM-dd')} (${endDate.toDateString()})`);
}
