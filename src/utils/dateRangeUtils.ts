import { TimeRange } from '@/hooks/use-insights-data';
import { formatDateForTimeRange } from '@/utils/date-formatter';
import { addDays, addWeeks, addMonths, addYears, startOfWeek, startOfMonth, startOfYear, startOfDay, startOfToday, endOfDay, endOfWeek, endOfMonth, endOfYear } from 'date-fns';

/**
 * Generates a dynamic time range label based on the time range, current date, and language
 */
export const getTimeRangeLabel = (timeRange: TimeRange, currentDate: Date, language: string = 'en'): string => {
  const now = new Date();
  const today = startOfDay(now);
  const currentPeriodStart = startOfDay(currentDate);
  
  // Check if we're viewing the current period
  const isCurrentPeriod = (() => {
    switch (timeRange) {
      case 'today':
        return currentPeriodStart.getTime() === today.getTime();
      case 'week': {
        const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
        const viewingWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        return currentWeekStart.getTime() === viewingWeekStart.getTime();
      }
      case 'month': {
        const currentMonthStart = startOfMonth(now);
        const viewingMonthStart = startOfMonth(currentDate);
        return currentMonthStart.getTime() === viewingMonthStart.getTime();
      }
      case 'year': {
        const currentYearStart = startOfYear(now);
        const viewingYearStart = startOfYear(currentDate);
        return currentYearStart.getTime() === viewingYearStart.getTime();
      }
      default:
        return false;
    }
  })();
  
  // Return "This [period]" if viewing current period
  if (isCurrentPeriod) {
    return `This ${timeRange}`;
  }
  
  // Otherwise, return the formatted date range
  switch (timeRange) {
    case 'today':
      return formatDateForTimeRange(currentDate, 'day', language);
    case 'week': {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 6);
      return `${formatDateForTimeRange(weekStart, 'short', language)} - ${formatDateForTimeRange(weekEnd, 'short', language)}`;
    }
    case 'month':
      return formatDateForTimeRange(currentDate, 'month', language);
    case 'year':
      return currentDate.getFullYear().toString();
    default:
      return `This ${timeRange}`;
  }
};

/**
 * Gets the date range (start and end) for a given time range and reference date
 */
export const getDateRangeForTimeRange = (timeRange: TimeRange, referenceDate: Date = new Date()): { startDate: Date, endDate: Date } => {
  switch (timeRange) {
    case 'today':
      return {
        startDate: startOfDay(referenceDate),
        endDate: endOfDay(referenceDate)
      };
      
    case 'week':
      return {
        startDate: startOfWeek(referenceDate, { weekStartsOn: 1 }),
        endDate: endOfWeek(referenceDate, { weekStartsOn: 1 })
      };
      
    case 'month':
      return {
        startDate: startOfMonth(referenceDate),
        endDate: endOfMonth(referenceDate)
      };
      
    case 'year':
      return {
        startDate: startOfYear(referenceDate),
        endDate: endOfYear(referenceDate)
      };
      
    default:
      // Default to week
      return {
        startDate: startOfWeek(referenceDate, { weekStartsOn: 1 }),
        endDate: endOfWeek(referenceDate, { weekStartsOn: 1 })
      };
  }
};
