
import { format, isToday, isYesterday, startOfDay, startOfWeek, startOfMonth, startOfYear, formatISO, parseISO, isValid } from 'date-fns';
import { TimeRange } from '@/hooks/use-insights-data';

/**
 * Formats a date based on the specified time range and language
 */
export const formatDateForTimeRange = (date: Date | string, range: TimeRange | 'day' | 'short' | 'month', language: string = 'en'): string => {
  if (!date) return '';
  
  // Ensure we have a valid Date object
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Return empty string for invalid dates
  if (!isValid(d)) return '';
  
  try {
    switch (range) {
      case 'today': {
        // Format as HH:MM with 24-hour format
        return new Intl.DateTimeFormat(language, { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }).format(d);
      }
      
      case 'day': {
        // Format as full date (e.g., "January 1, 2025")
        return new Intl.DateTimeFormat(language, {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }).format(d);
      }
        
      case 'week': {
        // Format as "Mon 1" (Short weekday + day number)
        const dayNum = d.getDate();
        const weekday = new Intl.DateTimeFormat(language, { weekday: 'short' }).format(d);
        return `${weekday} ${dayNum}`;
      }
      
      case 'short': {
        // Format as "Jan 1" (Short month + day number)
        return new Intl.DateTimeFormat(language, {
          month: 'short',
          day: 'numeric'
        }).format(d);
      }
        
      case 'month': {
        // Format as "January 2025"
        return new Intl.DateTimeFormat(language, {
          year: 'numeric',
          month: 'long'
        }).format(d);
      }
        
      case 'year': {
        // Short month name
        return new Intl.DateTimeFormat(language, { month: 'short' }).format(d);
      }
        
      default:
        // Default to day + short month (e.g., 15 Jan)
        return new Intl.DateTimeFormat(language, { 
          day: 'numeric', 
          month: 'short' 
        }).format(d);
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    
    // Fallback to a simple format
    try {
      return d.toLocaleDateString(language);
    } catch {
      return 'Invalid date';
    }
  }
};

/**
 * Filters data based on the selected time range
 */
export const filterDataByTimeRange = <T extends { date: Date | string }>(
  data: T[], 
  range: TimeRange
): T[] => {
  if (!data || !Array.isArray(data) || data.length === 0) return [];
  
  const now = new Date();
  let startDate: Date;
  
  switch (range) {
    case 'today':
      startDate = startOfDay(now);
      break;
    case 'week':
      startDate = startOfWeek(now, { weekStartsOn: 1 }); // Start on Monday
      break;
    case 'month':
      startDate = startOfMonth(now);
      break;
    case 'year':
      startDate = startOfYear(now);
      break;
    default:
      startDate = startOfWeek(now, { weekStartsOn: 1 });
  }
  
  return data.filter(item => {
    const itemDate = item.date instanceof Date ? item.date : new Date(item.date);
    return itemDate >= startDate;
  });
};

/**
 * Groups data by a formatted date key to avoid duplicates
 */
export const groupDataByFormattedDate = <T extends { date: Date | string; [key: string]: any }>(
  data: T[],
  timeRange: TimeRange,
  language: string,
  valueField: keyof T = 'value'
) => {
  const groupedData = new Map();
  
  data.forEach(item => {
    const date = item.date instanceof Date ? item.date : new Date(item.date);
    const formattedDate = formatDateForTimeRange(date, timeRange, language);
    const dateKey = formattedDate;
    
    if (!groupedData.has(dateKey)) {
      groupedData.set(dateKey, {
        formattedDate,
        originalDate: date,
        valueSum: Number(item[valueField]) || 0,
        count: 1
      });
    } else {
      const existing = groupedData.get(dateKey);
      existing.valueSum += Number(item[valueField]) || 0;
      existing.count += 1;
      
      // Keep the latest entry time for "today" view
      if (timeRange === 'today' && date > existing.originalDate) {
        existing.originalDate = date;
      }
    }
  });
  
  // Calculate averages for grouped data
  return Array.from(groupedData.values())
    .map(group => ({
      formattedDate: group.formattedDate,
      [valueField]: group.valueSum / group.count,
      originalDate: group.originalDate
    }))
    .sort((a, b) => a.originalDate.getTime() - b.originalDate.getTime());
};

/**
 * Formats ISO date string to a more readable format
 */
export const formatDateToReadable = (dateStr: string, includeYear = true): string => {
  if (!dateStr) return 'Unknown date';
  
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return 'Invalid date';
    
    if (isToday(date)) {
      return `Today at ${format(date, 'h:mm a')}`;
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    } else {
      return format(date, includeYear ? 'MMM d, yyyy' : 'MMM d');
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Unknown date';
  }
};

/**
 * Validates a date range to ensure it's not invalid
 */
export const validateDateRange = (startDate: string | Date, endDate: string | Date): boolean => {
  try {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    
    // Check for invalid dates using isValid
    if (!isValid(start) || !isValid(end)) {
      console.error('Invalid dates in range:', { startDate, endDate });
      return false;
    }
    
    // Check that start is before end
    if (start > end) {
      console.error('Start date is after end date:', { startDate, endDate });
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error validating date range:', error);
    return false;
  }
};

/**
 * Debug function to log date range information
 * Useful for troubleshooting date filtering issues
 */
export const debugDateRange = (startDate: Date | string | null, endDate: Date | string | null, context: string = ''): void => {
  try {
    const start = startDate ? (typeof startDate === 'string' ? new Date(startDate) : startDate) : null;
    const end = endDate ? (typeof endDate === 'string' ? new Date(endDate) : endDate) : null;
    
    console.log(`[DateDebug][${context}] Date Range:`, {
      startRaw: startDate,
      endRaw: endDate,
      startParsed: start ? start.toISOString() : 'null',
      endParsed: end ? end.toISOString() : 'null',
      isValid: start && end ? validateDateRange(start, end) : 'N/A'
    });
  } catch (error) {
    console.error(`[DateDebug][${context}] Error:`, error);
  }
};
