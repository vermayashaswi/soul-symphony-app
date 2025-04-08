
import { LogLevel } from "./debugLogTypes";

/**
 * Format a timestamp for display in the debug log
 */
export const formatLogTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  
  // Format with hours, minutes, seconds and milliseconds
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    // Remove the problematic fractionalSecondDigits property
  }).format(date) + `.${date.getMilliseconds().toString().padStart(3, '0')}`;
};

/**
 * Get the appropriate text color for a log level
 */
export const getLogLevelColor = (level: LogLevel): string => {
  switch (level) {
    case 'info':
      return 'text-blue-500';
    case 'success':
      return 'text-green-500';
    case 'warning':
      return 'text-amber-500';
    case 'error':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
};

/**
 * Get the appropriate background color for a log level
 */
export const getLogLevelBgColor = (level: LogLevel): string => {
  switch (level) {
    case 'info':
      return 'bg-blue-50';
    case 'success':
      return 'bg-green-50';
    case 'warning':
      return 'bg-amber-50';
    case 'error':
      return 'bg-red-50';
    default:
      return 'bg-gray-50';
  }
};
