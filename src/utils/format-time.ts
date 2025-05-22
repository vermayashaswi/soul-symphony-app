
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
  calculateDateRange
} from '@/services/dateService';

// Re-export the functions from our date service
export {
  isDirectDateQuery,
  getClientTimeInfo,
  getLastWeekDateRange,
  getCurrentWeekDateRange,
  debugTimezoneInfo,
  calculateDateRange
};
