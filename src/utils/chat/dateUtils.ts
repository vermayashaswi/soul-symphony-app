
import { 
  getClientTimeInfo,
  getLastWeekDateRange,
  getCurrentWeekDateRange,
  calculateDateRange,
  formatInTimezone,
  debugTimezoneInfo as debugTimezoneInfoService,
  getUserTimezoneName,
  getUserTimezoneOffset
} from '@/services/dateService';

// Re-export core functions from the centralized date service
export {
  getClientTimeInfo,
  getUserTimezoneOffset,
  getUserTimezoneName,
  formatInTimezone
};

/**
 * Get the formatted date range for the current week
 * @returns Formatted string with the current week's date range
 */
export function getCurrentWeekDates(timezone?: string): string {
  const { formattedRange } = getCurrentWeekDateRange(
    { timezoneName: timezone },
    timezone
  );
  return formattedRange;
}

/**
 * Get the formatted date range for the last week
 * @returns Formatted string with the last week's date range
 */
export function getLastWeekDates(timezone?: string): string {
  const { formattedRange } = getLastWeekDateRange(
    { timezoneName: timezone },
    timezone
  );
  return formattedRange;
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
  return calculateDateRange(
    timePeriod,
    {
      timestamp: clientTimestamp || (referenceDate ? referenceDate.toISOString() : undefined),
      timezoneName: userTimezone || getUserTimezoneName() || 'UTC',
      timezoneOffset: timezoneOffset
    },
    userTimezone
  );
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
 * Debug helper to log timezone information - uses our central service
 */
export function debugTimezoneInfo(): void {
  debugTimezoneInfoService();
}
