
import { addDays, addWeeks, addMonths, addYears, subDays, subWeeks, subMonths, subYears, startOfWeek, addDays as addDaysUtil } from 'date-fns';
import { formatDateForTimeRange } from '@/utils/date-formatter';

export const getNextDate = (timeframe: string, currentDate: Date): Date => {
  switch (timeframe) {
    case 'today':
      return addDays(currentDate, 1);
    case 'week':
      return addWeeks(currentDate, 1);
    case 'month':
      return addMonths(currentDate, 1);
    case 'year':
      return addYears(currentDate, 1);
    default:
      return addWeeks(currentDate, 1);
  }
};

export const getPreviousDate = (timeframe: string, currentDate: Date): Date => {
  switch (timeframe) {
    case 'today':
      return subDays(currentDate, 1);
    case 'week':
      return subWeeks(currentDate, 1);
    case 'month':
      return subMonths(currentDate, 1);
    case 'year':
      return subYears(currentDate, 1);
    default:
      return subWeeks(currentDate, 1);
  }
};

export const getPeriodLabel = (timeframe: string, activeDate: Date): string => {
  switch (timeframe) {
    case 'today':
      return formatDateForTimeRange(activeDate, 'day');
    case 'week': {
      const weekStart = startOfWeek(activeDate, { weekStartsOn: 1 });
      const weekEnd = addDaysUtil(weekStart, 6);
      return `${formatDateForTimeRange(weekStart, 'short')} - ${formatDateForTimeRange(weekEnd, 'short')}`;
    }
    case 'month':
      return formatDateForTimeRange(activeDate, 'month');
    case 'year':
      return activeDate.getFullYear().toString();
    default:
      return '';
  }
};
