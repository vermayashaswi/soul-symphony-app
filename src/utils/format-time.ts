import { formatDate } from 'date-fns';
import { 
  validateDateRange,
  getDateRangeForPeriod,
  getClientTimeInfo,
  getZonedDate,
  type DateRange
} from '@/services/dateService';

/**
 * Enhanced time formatting utilities
 */

export function formatTimeAgo(date: Date | string): string {
  try {
    const inputDate = typeof date === 'string' ? new Date(date) : date;
    
    // Validate the date
    if (!inputDate || isNaN(inputDate.getTime())) {
      return 'recently';
    }
    
    // Get user's timezone info and convert to local timezone
    const clientInfo = getClientTimeInfo();
    const userTimezone = clientInfo.timezoneName;
    
    const zonedInputDate = getZonedDate(inputDate, userTimezone);
    const zonedNow = getZonedDate(new Date(), userTimezone);
    
    const diffInSeconds = Math.floor((zonedNow.getTime() - zonedInputDate.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    return formatDate(zonedInputDate, 'MMM d, yyyy');
  } catch (error) {
    console.error('[formatTimeAgo] Error formatting date:', error);
    return 'recently';
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

// NEW: Add formatTime function for recording duration
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Updated formatShortDate function to return objects for translation with timezone-aware comparisons
export function formatShortDate(date: Date | string): { type: 'translatable' | 'formatted', text: string, formatPattern?: string } {
  try {
    const inputDate = typeof date === 'string' ? new Date(date) : date;
    
    // Validate the date
    if (!inputDate || isNaN(inputDate.getTime())) {
      console.error('[formatShortDate] Invalid date:', date);
      return { type: 'translatable', text: 'Recently' };
    }
    
    // Get user's timezone info
    const clientInfo = getClientTimeInfo();
    const userTimezone = clientInfo.timezoneName;
    
    // Convert GMT timestamp to user's local timezone for comparison
    const zonedInputDate = getZonedDate(inputDate, userTimezone);
    const zonedNow = getZonedDate(new Date(), userTimezone);
    
    // Get start of day for both dates in user's timezone to properly compare days
    const inputDateStart = new Date(zonedInputDate.getFullYear(), zonedInputDate.getMonth(), zonedInputDate.getDate());
    const nowStart = new Date(zonedNow.getFullYear(), zonedNow.getMonth(), zonedNow.getDate());
    
    const diffInDays = Math.floor((nowStart.getTime() - inputDateStart.getTime()) / (1000 * 60 * 60 * 24));
    
    // Today
    if (diffInDays === 0) {
      return { type: 'translatable', text: 'Today' };
    }
    
    // Yesterday
    if (diffInDays === 1) {
      return { type: 'translatable', text: 'Yesterday' };
    }
    
    // This week (within 6 days) - return day name for translation
    if (diffInDays < 7) {
      const dayName = formatDate(zonedInputDate, 'EEEE'); // Day name in English
      return { type: 'translatable', text: dayName };
    }
    
    // This year - return formatted date for translation
    if (zonedInputDate.getFullYear() === zonedNow.getFullYear()) {
      const formattedDate = formatDate(zonedInputDate, 'MMM d');
      return { type: 'formatted', text: formattedDate, formatPattern: 'MMM d' };
    }
    
    // Previous years - return formatted date for translation
    const formattedDate = formatDate(zonedInputDate, 'MMM d, yyyy');
    return { type: 'formatted', text: formattedDate, formatPattern: 'MMM d, yyyy' };
  } catch (error) {
    console.error('[formatShortDate] Error formatting date:', error);
    return { type: 'translatable', text: 'Recently' };
  }
}

// Keep the original function for backward compatibility but mark as deprecated
export function formatShortDateLegacy(date: Date | string): string {
  const result = formatShortDate(date);
  return result.text;
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
