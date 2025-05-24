
import { formatDate } from 'date-fns';
import { 
  validateDateRange,
  getDateRangeForPeriod,
  type DateRange
} from '@/services/dateService';

/**
 * Enhanced time formatting utilities
 */

export function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  const diffInSeconds = Math.floor((now.getTime() - inputDate.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  
  return formatDate(inputDate, 'MMM d, yyyy');
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function isValidTimeRange(startDate: string, endDate: string): boolean {
  return validateDateRange(startDate, endDate);
}

export function getStandardDateRange(period: string, timezone: string = 'UTC'): DateRange | null {
  try {
    switch (period) {
      case 'today':
        return getDateRangeForPeriod('today', timezone);
      case 'yesterday':
        return getDateRangeForPeriod('yesterday', timezone);
      case 'thisWeek':
        return getDateRangeForPeriod('thisWeek', timezone);
      case 'lastWeek':
        return getDateRangeForPeriod('lastWeek', timezone);
      case 'thisMonth':
        return getDateRangeForPeriod('thisMonth', timezone);
      case 'lastMonth':
        return getDateRangeForPeriod('lastMonth', timezone);
      default:
        return null;
    }
  } catch (error) {
    console.error(`Error getting date range for ${period}:`, error);
    return null;
  }
}
