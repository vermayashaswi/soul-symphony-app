
/**
 * Debug utility functions for logging and diagnostics
 */

import { v4 as uuidv4 } from 'uuid';
import { DebugLogEntry, LogLevel } from './debugLogTypes';

/**
 * Creates a new debug log entry
 */
export const createLogEntry = (
  category: string, 
  message: string, 
  level: LogLevel = 'info',
  details?: any
): DebugLogEntry => {
  return {
    id: uuidv4(),
    timestamp: Date.now(),
    category,
    message,
    level,
    details
  };
};

/**
 * Formats a timestamp for display
 */
export const formatLogTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });
};

/**
 * Gets the appropriate color for a log level
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
 * Gets the appropriate background color for a log level
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

/**
 * Convert milliseconds to a readable duration
 */
export const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
};
