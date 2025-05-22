
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
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatShortDate(date: Date): string {
  return format(date, 'MMM d, yyyy');
}

/**
 * Format time string for display in chat messages
 * @param date - Date to format
 * @returns Formatted time string (e.g., "3:45 PM")
 */
export function formatMessageTime(date: Date): string {
  return format(date, 'h:mm a');
}
