
import { 
  getCurrentWeekDateRange, 
  getLastWeekDateRange, 
  getClientTimeInfo,
  validateDateRange,
  getDateRangeForPeriod,
  type ClientTimeInfo,
  type DateRange
} from '@/services/dateService';

/**
 * Enhanced date utilities for chat queries with improved relative time support
 */

export function detectRelativeTimeExpression(message: string): string | null {
  const lowerMessage = message.toLowerCase().trim();
  
  const timeExpressions = [
    { pattern: /\b(this week|current week)\b/i, value: 'this_week' },
    { pattern: /\b(last week|previous week)\b/i, value: 'last_week' },
    { pattern: /\b(yesterday)\b/i, value: 'yesterday' },
    { pattern: /\b(today)\b/i, value: 'today' },
    { pattern: /\b(this month|current month)\b/i, value: 'this_month' },
    { pattern: /\b(last month|previous month)\b/i, value: 'last_month' },
    { pattern: /\b(recently|lately)\b/i, value: 'recent' }
  ];
  
  for (const expr of timeExpressions) {
    if (expr.pattern.test(lowerMessage)) {
      return expr.value;
    }
  }
  
  return null;
}

export function calculateRelativeDateRange(
  timeExpression: string, 
  timezone: string = 'UTC'
): DateRange | null {
  const clientInfo = getClientTimeInfo();
  
  try {
    switch (timeExpression) {
      case 'this_week': {
        const result = getCurrentWeekDateRange(clientInfo, timezone);
        return result.rangeObj;
      }
      case 'last_week': {
        const result = getLastWeekDateRange(clientInfo, timezone);
        return result.rangeObj;
      }
      case 'today':
        return getDateRangeForPeriod('today', timezone);
      case 'yesterday':
        return getDateRangeForPeriod('yesterday', timezone);
      case 'this_month':
        return getDateRangeForPeriod('thisMonth', timezone);
      case 'last_month':
        return getDateRangeForPeriod('lastMonth', timezone);
      default:
        return null;
    }
  } catch (error) {
    console.error(`Error calculating date range for ${timeExpression}:`, error);
    return null;
  }
}

export function extractReferenceDate(message: string): Date | null {
  // Simple extraction for now - can be enhanced later
  const now = new Date();
  return now;
}

export function isRelativeTimeQuery(message: string): boolean {
  return detectRelativeTimeExpression(message) !== null;
}

export function formatDateRange(dateRange: DateRange): string {
  const start = new Date(dateRange.startDate);
  const end = new Date(dateRange.endDate);
  
  const formatOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  return `${start.toLocaleDateString('en-US', formatOptions)} - ${end.toLocaleDateString('en-US', formatOptions)}`;
}
