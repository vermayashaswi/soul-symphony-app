/**
 * Utilities for handling date and time operations in chat queries
 */

import { differenceInDays } from "date-fns";

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
 * Checks if a query appears to be a relative time query
 */
export function isRelativeTimeQuery(query: string): boolean {
  return !!detectRelativeTimeExpression(query);
}

/**
 * Extracts a reference date from conversation context if applicable
 * @param conversationContext - Previous messages in the conversation
 * @returns Date object or undefined if no reference date found
 */
export function extractReferenceDate(conversationContext: any[]): Date | undefined {
  if (!conversationContext || conversationContext.length === 0) {
    return undefined;
  }
  
  // Look for date references in recent messages, starting from the most recent
  for (let i = conversationContext.length - 1; i >= 0; i--) {
    const message = conversationContext[i];
    
    // Skip non-user messages
    if (message.role !== 'user') continue;
    
    // Check for time expressions in the message
    const timeExpression = detectRelativeTimeExpression(message.content);
    if (timeExpression) {
      // If we find a time expression, use the current date as reference
      return new Date();
    }
  }
  
  return undefined;
}

/**
 * Calculates date range based on a time expression
 * @param timeExpression - String like "last week", "this month", etc.
 * @returns Object with start date, end date, period name and duration
 */
export function calculateRelativeDateRange(
  timeExpression: string,
  referenceDate?: Date
): {
  startDate: string | null;
  endDate: string | null;
  periodName: string;
  duration: number;
} {
  // Use provided reference date or current date
  const now = referenceDate || new Date();
  const lowerExpression = timeExpression.toLowerCase();
  
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  let periodName = timeExpression;
  let duration = 0;
  
  // Match expression to date range
  if (lowerExpression.includes('today')) {
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    
    duration = 1;
  } 
  else if (lowerExpression.includes('yesterday')) {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    
    endDate = new Date(now);
    endDate.setDate(now.getDate() - 1);
    endDate.setHours(23, 59, 59, 999);
    
    duration = 1;
  }
  else if (lowerExpression.includes('this week')) {
    // Start of current week (Sunday)
    startDate = new Date(now);
    startDate.setDate(now.getDate() - now.getDay());
    startDate.setHours(0, 0, 0, 0);
    
    // End of current week (Saturday)
    endDate = new Date(now);
    endDate.setDate(now.getDate() + (6 - now.getDay()));
    endDate.setHours(23, 59, 59, 999);
    
    duration = 7;
  }
  else if (lowerExpression.includes('last week')) {
    // Start of last week
    startDate = new Date(now);
    startDate.setDate(now.getDate() - now.getDay() - 7);
    startDate.setHours(0, 0, 0, 0);
    
    // End of last week
    endDate = new Date(now);
    endDate.setDate(now.getDate() - now.getDay() - 1);
    endDate.setHours(23, 59, 59, 999);
    
    duration = 7;
  }
  else if (lowerExpression.match(/past (\d+) days?/)) {
    const matches = lowerExpression.match(/past (\d+) days?/);
    if (matches && matches[1]) {
      const days = parseInt(matches[1], 10);
      
      startDate = new Date(now);
      startDate.setDate(now.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
      
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      
      duration = days;
      periodName = `past ${days} days`;
    }
  }
  else if (lowerExpression.includes('this month')) {
    // Start of current month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // End of current month
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Calculate duration (number of days in current month)
    duration = endDate.getDate();
  }
  else if (lowerExpression.includes('last month')) {
    // Start of last month
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    // End of last month
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    
    // Calculate duration (number of days in last month)
    duration = endDate.getDate();
  }
  else if (lowerExpression.includes('this year')) {
    // Start of current year
    startDate = new Date(now.getFullYear(), 0, 1);
    
    // End of current year
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    
    duration = 365; // Approximation, doesn't account for leap years
  }
  else if (lowerExpression.includes('last year')) {
    // Start of last year
    startDate = new Date(now.getFullYear() - 1, 0, 1);
    
    // End of last year
    endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    
    duration = 365; // Approximation, doesn't account for leap years
  }
  else if (lowerExpression.includes('all time') || 
           lowerExpression.includes('entire') || 
           lowerExpression.includes('everything') ||
           lowerExpression === 'all') {
    // A broad date range for "all time" - 5 years back to now
    startDate = new Date(now);
    startDate.setFullYear(startDate.getFullYear() - 5);
    startDate.setHours(0, 0, 0, 0);
    
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    
    periodName = 'all time';
    duration = 365 * 5; // Approximately 5 years
  }
  else {
    // Default to last 14 days if we can't identify the time period
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 14);
    startDate.setHours(0, 0, 0, 0);
    
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    
    periodName = 'recent';
    duration = 14;
  }
  
  // Calculate duration if not explicitly set and we have both start and end dates
  if (duration === 0 && startDate && endDate) {
    duration = differenceInDays(endDate, startDate) + 1; // +1 to include both start and end days
  }
  
  return {
    startDate: startDate ? startDate.toISOString() : null,
    endDate: endDate ? endDate.toISOString() : null,
    periodName,
    duration
  };
}
