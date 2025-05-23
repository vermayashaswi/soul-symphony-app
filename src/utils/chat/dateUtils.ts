
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
  console.log(`[dateUtils] Getting current week dates for timezone: ${timezone || 'default'}`);
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
  console.log(`[dateUtils] Getting last week dates for timezone: ${timezone || 'default'}`);
  const { formattedRange } = getLastWeekDateRange(
    { timezoneName: timezone },
    timezone
  );
  return formattedRange;
}

/**
 * Calculates relative date ranges based on time expressions
 * Enhanced to work with the consolidated chat-with-rag function
 */
export function calculateRelativeDateRange(
  timePeriod: string, 
  timezoneOffset: number = 0,
  referenceDate?: Date,
  clientTimestamp?: string,
  userTimezone?: string
): { startDate: string, endDate: string, periodName: string } {
  console.log(`[dateUtils] Enhanced debugging - Calculating relative date range for "${timePeriod}"`);
  console.log(`[dateUtils] Enhanced debugging - Using timezone offset: ${timezoneOffset}, timezone: ${userTimezone || 'not provided'}`);
  console.log(`[dateUtils] Enhanced debugging - Reference date: ${referenceDate?.toISOString() || 'none'}`);
  console.log(`[dateUtils] Enhanced debugging - Client timestamp: ${clientTimestamp || 'none'}`);
  
  const result = calculateDateRange(
    timePeriod,
    {
      timestamp: clientTimestamp || (referenceDate ? referenceDate.toISOString() : undefined),
      timezoneName: userTimezone || getUserTimezoneName() || 'UTC',
      timezoneOffset: timezoneOffset
    },
    userTimezone
  );
  
  console.log(`[dateUtils] Enhanced debugging - Calculated date range result:`, result);
  return result;
}

/**
 * Detects relative time expressions in a query
 * Enhanced for better detection with the consolidated system
 */
export function detectRelativeTimeExpression(query: string): string | null {
  if (!query) return null;
  
  const lowerQuery = query.toLowerCase().trim();
  console.log(`[dateUtils] Enhanced debugging - Detecting time expression in: "${lowerQuery}"`);
  
  // Enhanced time period expressions for the consolidated system
  const timePeriodPatterns = [
    /\btoday\b/,
    /\byesterday\b/,
    /\bthis\s+(day|week|month|year)\b/,
    /\blast\s+(day|week|month|year|(\d+)\s+days?|(\d+)\s+weeks?|(\d+)\s+months?|(\d+)\s+years?)\b/,
    /\b(recent|past|previous)\s+(day|week|month|year|(\d+)\s+days?|(\d+)\s+weeks?|(\d+)\s+months?|(\d+)\s+years?)\b/,
    /\ball(\s+time)?\b/,
    /\bentire\b/,
    /\beverything\b/,
    /\boverall\b/,
    // Enhanced patterns for emotion queries
    /\btop\s+\d+\s+(emotion|feeling|mood)s?\b/,
    /\b(emotion|feeling|mood)s?\s+(last|this|during|in|for)\s+(week|month|year)\b/
  ];
  
  // Check for time expressions in the query
  for (const pattern of timePeriodPatterns) {
    const match = lowerQuery.match(pattern);
    if (match) {
      console.log(`[dateUtils] Enhanced debugging - Detected time expression: ${match[0]} with pattern: ${pattern}`);
      return match[0];
    }
  }
  
  // Special case for emotion-specific queries with time context
  if (/\b(emotion|feeling|mood)s?\b.*\b(last|this|during|in|for)\b/i.test(lowerQuery)) {
    const timeMatch = lowerQuery.match(/\b(last|this|during|in|for)\s+(week|month|year|day)\b/i);
    if (timeMatch) {
      console.log(`[dateUtils] Enhanced debugging - Detected emotion-time expression: ${timeMatch[0]}`);
      return timeMatch[0];
    }
  }
  
  // Special case for simple query like "last month?" or "what about last year?"
  if (/^(what\s+about\s+)?(the\s+)?(last|this|previous|past|recent)\s+(day|week|month|year|(\d+)\s+days?|(\d+)\s+weeks?|(\d+)\s+months?|(\d+)\s+years?)(\?|\.|$)/i.test(lowerQuery)) {
    const match = lowerQuery.match(/(last|this|previous|past|recent)\s+(day|week|month|year|(\d+)\s+days?|(\d+)\s+weeks?|(\d+)\s+months?|(\d+)\s+years?)/i);
    if (match) {
      console.log(`[dateUtils] Enhanced debugging - Detected special case time expression: ${match[0]}`);
      return match[0];
    }
  }
  
  console.log(`[dateUtils] Enhanced debugging - No time expression detected in query: ${lowerQuery}`);
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
  
  try {
    const referenceDate = new Date(previousDateRange.endDate);
    if (isNaN(referenceDate.getTime())) {
      return undefined;
    }
    console.log(`[dateUtils] Enhanced debugging - Extracted reference date: ${referenceDate.toISOString()}`);
    return referenceDate;
  } catch (error) {
    console.error("[dateUtils] Enhanced debugging - Error extracting reference date:", error);
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
  console.log(`[dateUtils] Enhanced debugging - Checking if relative time query: "${lowerQuery}"`);
  
  const relativeTimePatterns = [
    /^(what|how) about (last|this|previous|past|recent)/i,
    /^(show|tell|give) me (last|this|previous|past|recent)/i,
    /^(and|or|but) (last|this|previous|past|recent)/i,
    /^(last|this|previous|past|recent)/i
  ];
  
  for (const pattern of relativeTimePatterns) {
    if (pattern.test(lowerQuery)) {
      console.log(`[dateUtils] Enhanced debugging - Detected relative time query: ${lowerQuery} with pattern: ${pattern}`);
      return true;
    }
  }
  
  if (/^(today|yesterday|this week|last week|this month|last month|this year|last year)(\?|\.)?$/i.test(lowerQuery)) {
    console.log(`[dateUtils] Enhanced debugging - Detected standalone time period query: ${lowerQuery}`);
    return true;
  }
  
  console.log(`[dateUtils] Enhanced debugging - Not a relative time query: ${lowerQuery}`);
  return false;
}

/**
 * Debug helper to log timezone information - uses our central service
 */
export function debugTimezoneInfo(): void {
  console.log("[dateUtils] Enhanced debugging - Calling central timezone debug service");
  debugTimezoneInfoService();
}
