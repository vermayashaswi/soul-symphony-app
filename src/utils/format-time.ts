
/**
 * Unified Date Formatting Utilities
 * 
 * This file provides date formatting functions and re-exports
 * functionality from our date service for backward compatibility.
 */

import { 
  isDirectDateQuery, 
  getClientTimeInfo, 
  getLastWeekDateRange,
  getCurrentWeekDateRange,
  debugTimezoneInfo,
  calculateDateRange,
  formatInTimezone as formatInTimezoneService
} from '@/services/dateService';

import { format, isValid } from 'date-fns';

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
 * Format a date in a specific timezone
 * @param date - Date to format
 * @param formatStr - Format string
 * @param timezone - Target timezone
 * @returns Formatted date string
 */
export function formatInTimezone(
  date: Date | string,
  formatStr: string = 'yyyy-MM-dd HH:mm:ss',
  timezone: string = 'UTC'
): string {
  return formatInTimezoneService(date, formatStr, timezone);
}

/**
 * Format a time value in seconds to MM:SS format
 * @param seconds - Time in seconds to format
 * @returns Formatted time string
 */
export function formatTime(seconds: number): string {
  if (typeof seconds !== 'number') {
    console.error('Invalid seconds value provided to formatTime:', seconds);
    return '00:00';
  }

  try {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  } catch (error) {
    console.error('Error in formatTime:', error);
    return '00:00';
  }
}

/**
 * Format a date to a short readable format (e.g., "May 15, 2025")
 * @param date - Date to format (can be Date object or string)
 * @returns Formatted date string
 */
export function formatShortDate(date: Date | string): string {
  if (!date) {
    console.error('Null or undefined date provided to formatShortDate');
    return 'Invalid Date';
  }

  try {
    // Convert to Date object if a string is provided
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if date is valid before formatting
    if (!isValid(dateObj)) {
      console.error('Invalid date provided to formatShortDate:', date);
      return 'Invalid Date';
    }
    
    return format(dateObj, 'MMM d, yyyy');
  } catch (error) {
    console.error('Error formatting short date:', error, 'Input:', date);
    return 'Invalid Date';
  }
}

/**
 * Format time string for display in chat messages
 * @param date - Date to format (can be Date object or string)
 * @returns Formatted time string (e.g., "3:45 PM")
 */
export function formatMessageTime(date: Date | string): string {
  if (!date) {
    console.error('Null or undefined date provided to formatMessageTime');
    return 'Invalid Time';
  }

  try {
    // Convert to Date object if a string is provided
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if date is valid before formatting
    if (!isValid(dateObj)) {
      console.error('Invalid date provided to formatMessageTime:', date);
      return 'Invalid Time';
    }
    
    return format(dateObj, 'h:mm a');
  } catch (error) {
    console.error('Error formatting message time:', error, 'Input:', date);
    return 'Invalid Time';
  }
}
