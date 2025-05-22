
/**
 * This file re-exports the date functionality from our date service
 * to maintain backward compatibility with existing imports.
 */

import { 
  isDirectDateQuery, 
  getClientTimeInfo, 
  getLastWeekDateRange,
  getCurrentWeekDateRange,
  debugTimezoneInfo,
  calculateDateRange,
  formatInTimezone
} from '@/services/dateService';

import { format } from 'date-fns';

// Re-export the functions from our date service
export {
  isDirectDateQuery,
  getClientTimeInfo,
  getLastWeekDateRange,
  getCurrentWeekDateRange,
  debugTimezoneInfo,
  calculateDateRange
};

/**
 * Format a time value in seconds to MM:SS format
 * @param seconds - Time in seconds to format
 * @returns Formatted time string
 */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Format a date to a short readable format (e.g., "May 15, 2025")
 * @param date - Date to format (can be Date object or string)
 * @returns Formatted date string
 */
export function formatShortDate(date: Date | string): string {
  try {
    // Convert to Date object if a string is provided
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'MMM d, yyyy');
  } catch (error) {
    console.error('Error formatting short date:', error);
    return 'Invalid Date';
  }
}

/**
 * Format time string for display in chat messages
 * @param date - Date to format (can be Date object or string)
 * @returns Formatted time string (e.g., "3:45 PM")
 */
export function formatMessageTime(date: Date | string): string {
  try {
    // Convert to Date object if a string is provided
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'h:mm a');
  } catch (error) {
    console.error('Error formatting message time:', error);
    return 'Invalid Time';
  }
}
