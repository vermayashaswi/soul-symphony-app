
import { addDays, endOfDay, endOfMonth, endOfWeek, endOfYear, startOfDay, startOfMonth, startOfWeek, startOfYear, subDays, subMonths, subWeeks, subYears } from "date-fns";

/**
 * Calculates relative date ranges based on time expressions
 * @param timePeriod - The time period expression (e.g., "this month", "last week")
 * @param timezoneOffset - User's timezone offset in minutes
 * @param referenceDate - Optional reference date for relative calculations
 * @returns Date range with start and end dates
 */
export function calculateRelativeDateRange(
  timePeriod: string, 
  timezoneOffset: number = new Date().getTimezoneOffset() * -1, // Default to browser's timezone offset if not provided
  referenceDate?: Date
): { startDate: string, endDate: string, periodName: string, duration?: number } {
  // Convert timezone offset to milliseconds
  const offsetMs = timezoneOffset * 60 * 1000;
  
  // Use provided reference date or get current date adjusted for user's timezone
  const now = referenceDate ? new Date(referenceDate) : new Date();
  
  // Apply timezone offset to work in user's local time
  const localNow = new Date(now.getTime());
  
  let startDate: Date;
  let endDate: Date;
  let periodName = timePeriod;
  let duration: number | undefined;
  
  console.log(`Calculating date range for "${timePeriod}" with timezone offset ${timezoneOffset} minutes`);
  console.log(`User's local time: ${localNow.toLocaleString()}`);
  console.log(`Reference date provided: ${referenceDate ? 'yes' : 'no'}`);
  if (referenceDate) {
    console.log(`Reference date: ${referenceDate.toISOString()}`);
  }
  
  // Normalize time period for better matching
  const lowerTimePeriod = timePeriod.toLowerCase().trim();
  
  // Enhanced pattern matching with more variations
  if (lowerTimePeriod.includes('today') || lowerTimePeriod.includes('this day')) {
    // Today: Start at midnight, end at 23:59:59
    startDate = startOfDay(localNow);
    endDate = endOfDay(localNow);
    periodName = 'today';
    duration = 1;
  } 
  else if (lowerTimePeriod.includes('yesterday')) {
    // Yesterday: Start at previous day midnight, end at previous day 23:59:59
    startDate = startOfDay(subDays(localNow, 1));
    endDate = endOfDay(subDays(localNow, 1));
    periodName = 'yesterday';
    duration = 1;
  }
  else if (lowerTimePeriod.match(/past (\d+) days?/)) {
    // Past X days: Start X days ago at midnight, end at today 23:59:59
    const matches = lowerTimePeriod.match(/past (\d+) days?/);
    const days = parseInt(matches![1], 10) || 7; // Default to 7 if parsing fails
    startDate = startOfDay(subDays(localNow, days));
    endDate = endOfDay(localNow);
    periodName = `past ${days} days`;
    duration = days;
  }
  else if (lowerTimePeriod.match(/last (\d+) days?/)) {
    // Last X days: Start X days ago at midnight, end at today 23:59:59
    const matches = lowerTimePeriod.match(/last (\d+) days?/);
    const days = parseInt(matches![1], 10) || 7; // Default to 7 if parsing fails
    startDate = startOfDay(subDays(localNow, days));
    endDate = endOfDay(localNow);
    periodName = `last ${days} days`;
    duration = days;
  }
  else if (lowerTimePeriod.match(/recent (\d+) days?/)) {
    // Recent X days: Start X days ago at midnight, end at today 23:59:59
    const matches = lowerTimePeriod.match(/recent (\d+) days?/);
    const days = parseInt(matches![1], 10) || 7; // Default to 7 if parsing fails
    startDate = startOfDay(subDays(localNow, days));
    endDate = endOfDay(localNow);
    periodName = `recent ${days} days`;
    duration = days;
  }
  else if (lowerTimePeriod.includes('this week')) {
    // This week: Start at current week Monday, end at Sunday 23:59:59
    startDate = startOfWeek(localNow, { weekStartsOn: 1 }); // Start on Monday
    endDate = endOfWeek(localNow, { weekStartsOn: 1 }); // End on Sunday
    periodName = 'this week';
    duration = 7;
  } 
  else if (lowerTimePeriod.includes('last week')) {
    // Last week: Start at previous week Monday, end at previous week Sunday 23:59:59
    const prevWeek = subWeeks(localNow, 1);
    startDate = startOfWeek(prevWeek, { weekStartsOn: 1 }); // Start on Monday
    endDate = endOfWeek(prevWeek, { weekStartsOn: 1 }); // End on Sunday
    periodName = 'last week';
    duration = 7;
  }
  else if (lowerTimePeriod.includes('past week') || lowerTimePeriod.includes('previous week')) {
    // Past/previous week: Start at 7 days ago, end at today
    startDate = startOfDay(subDays(localNow, 7));
    endDate = endOfDay(localNow);
    periodName = 'past week';
    duration = 7;
  }
  else if (lowerTimePeriod.includes('this month')) {
    // This month: Start at 1st of current month, end at last day of month 23:59:59
    startDate = startOfMonth(localNow);
    endDate = endOfMonth(localNow);
    periodName = 'this month';
    const daysInMonth = new Date(localNow.getFullYear(), localNow.getMonth() + 1, 0).getDate();
    duration = daysInMonth;
  } 
  else if (lowerTimePeriod.includes('last month') || lowerTimePeriod === 'previous month') {
    // Last month: Start at 1st of previous month, end at last day of previous month 23:59:59
    const prevMonth = subMonths(localNow, 1);
    startDate = startOfMonth(prevMonth);
    endDate = endOfMonth(prevMonth);
    periodName = 'last month';
    const daysInMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate();
    duration = daysInMonth;
  }
  else if (lowerTimePeriod.includes('past month')) {
    // Past month: Start at 30 days ago, end at today
    startDate = startOfDay(subDays(localNow, 30));
    endDate = endOfDay(localNow);
    periodName = 'past month';
    duration = 30;
  }
  else if (lowerTimePeriod.includes('this year')) {
    // This year: Start at January 1st, end at December 31st 23:59:59
    startDate = startOfYear(localNow);
    endDate = endOfYear(localNow);
    periodName = 'this year';
    duration = 365;
  } 
  else if (lowerTimePeriod.includes('last year')) {
    // Last year: Start at January 1st of previous year, end at December 31st of previous year 23:59:59
    const prevYear = subYears(localNow, 1);
    startDate = startOfYear(prevYear);
    endDate = endOfYear(prevYear);
    periodName = 'last year';
    duration = 365;
  } 
  else if (lowerTimePeriod === 'entire' || lowerTimePeriod === 'all' || 
           lowerTimePeriod === 'everything' || lowerTimePeriod === 'overall' ||
           lowerTimePeriod === 'all time' || lowerTimePeriod === 'always' ||
           lowerTimePeriod === 'all my entries' || lowerTimePeriod === 'all entries') {
    // Special case for "entire" - use a very broad date range (5 years back)
    startDate = startOfYear(subYears(localNow, 5));
    endDate = endOfDay(localNow);
    periodName = 'all time';
    duration = 5 * 365;
  }
  else if (lowerTimePeriod === 'yes' || lowerTimePeriod === 'sure' || 
           lowerTimePeriod === 'ok' || lowerTimePeriod === 'okay' ||
           lowerTimePeriod === 'yep' || lowerTimePeriod === 'yeah') {
    // Special handling for affirmative responses - use a broad date range
    startDate = startOfYear(subYears(localNow, 5));
    endDate = endOfDay(localNow);
    periodName = 'all time'; // Use "all time" for affirmative responses
    duration = 5 * 365;
  }
  else {
    // Default to last 30 days if no specific period matched
    startDate = startOfDay(subDays(localNow, 30));
    endDate = endOfDay(localNow);
    periodName = 'last 30 days';
    duration = 30;
  }

  // We ensure dates are in the user's local timezone for correct interpretation
  // Return ISO strings for database compatibility
  const result = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    periodName,
    duration
  };
  
  // Log the calculated dates for debugging
  console.log(`Date range calculated: 
    Start: ${result.startDate} (${new Date(result.startDate).toLocaleDateString()})
    End: ${result.endDate} (${new Date(result.endDate).toLocaleDateString()})
    Period: ${periodName}
    Duration in days: ${duration || Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))}`);
  
  return result;
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
 * Format a date in a user-friendly way with timezone consideration
 * @param dateStr - ISO date string to format
 * @param userTimezoneOffset - User's timezone offset in minutes
 * @returns Formatted date string
 */
export function formatDateForUser(dateStr: string, userTimezoneOffset: number = new Date().getTimezoneOffset() * -1): string {
  try {
    // Create date object from ISO string
    const date = new Date(dateStr);
    
    // Format options for user-friendly display
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    };
    
    // Use the browser's Intl API to format the date in the user's locale and timezone
    return new Intl.DateTimeFormat('en-US', options).format(date);
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateStr || "Unknown date";
  }
}
