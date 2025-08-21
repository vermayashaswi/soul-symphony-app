/**
 * Enhanced timezone validation and debugging utilities for RAG pipeline
 */

export interface TimezoneValidationResult {
  isValid: boolean;
  normalizedTimezone: string;
  issues: string[];
  recommendations: string[];
}

export interface TimezoneDebugInfo {
  input: {
    originalTimezone: string;
    normalizedTimezone: string;
  };
  conversion: {
    isValid: boolean;
    currentTime: string;
    currentHour: number;
    error?: string;
    rawUtcTime: string;
  };
  validation: TimezoneValidationResult;
  systemInfo: {
    functionName: string;
    timestamp: string;
    userAgent?: string;
  };
}

/**
 * Comprehensive timezone validation with detailed feedback
 */
export function validateUserTimezone(userTimezone: string): TimezoneValidationResult {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Normalize timezone
  let normalizedTimezone = userTimezone || 'UTC';
  
  // Basic validation
  if (!userTimezone) {
    issues.push('No timezone provided');
    recommendations.push('Using UTC as fallback - consider setting user timezone in profile');
  }
  
  // Test timezone validity by attempting conversion
  try {
    const testDate = new Date();
    testDate.toLocaleString('en-US', { timeZone: normalizedTimezone });
  } catch (error) {
    issues.push(`Invalid timezone format: ${normalizedTimezone}`);
    recommendations.push('Use IANA timezone names (e.g., America/New_York, Europe/London, Asia/Tokyo)');
    normalizedTimezone = 'UTC';
  }
  
  // Validate common timezone patterns
  const validTimezonePattern = /^[A-Za-z_\/]+\/[A-Za-z_]+$|^UTC$|^GMT[+-]\d{1,2}$/;
  if (!validTimezonePattern.test(normalizedTimezone) && normalizedTimezone !== 'UTC') {
    issues.push(`Timezone format might be non-standard: ${normalizedTimezone}`);
    recommendations.push('Consider using standard IANA timezone identifiers');
  }
  
  return {
    isValid: issues.length === 0,
    normalizedTimezone,
    issues,
    recommendations
  };
}

/**
 * Convert time with timezone information and generate debug info
 */
export function debugTimezoneInfo(
  userTimezone: string, 
  functionName: string, 
  userAgent?: string
): TimezoneDebugInfo {
  const originalTimezone = userTimezone || 'UTC';
  const validation = validateUserTimezone(originalTimezone);
  const normalizedTimezone = validation.normalizedTimezone;
  
  let conversionInfo = {
    isValid: false,
    currentTime: '',
    currentHour: 0,
    error: undefined as string | undefined,
    rawUtcTime: new Date().toISOString()
  };
  
  try {
    const now = new Date();
    const userLocalTime = now.toLocaleString('en-US', { 
      timeZone: normalizedTimezone,
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const userHour = parseInt(now.toLocaleString('en-US', { 
      timeZone: normalizedTimezone,
      hour: 'numeric',
      hour12: false
    }));
    
    conversionInfo = {
      isValid: true,
      currentTime: userLocalTime,
      currentHour: userHour,
      rawUtcTime: now.toISOString()
    };
  } catch (error) {
    conversionInfo.error = error instanceof Error ? error.message : 'Unknown timezone conversion error';
  }
  
  return {
    input: {
      originalTimezone,
      normalizedTimezone
    },
    conversion: conversionInfo,
    validation,
    systemInfo: {
      functionName,
      timestamp: new Date().toISOString(),
      userAgent
    }
  };
}

/**
 * Validate that timeRange objects include proper timezone information
 */
export function validateTimeRangeTimezone(timeRange: any, userTimezone: string): {
  isValid: boolean;
  correctedTimeRange: any;
  issues: string[];
} {
  const issues: string[] = [];
  
  if (!timeRange) {
    return { isValid: true, correctedTimeRange: null, issues: [] };
  }
  
  let correctedTimeRange = { ...timeRange };
  
  // Ensure timezone is included
  if (!timeRange.timezone) {
    correctedTimeRange.timezone = userTimezone;
    issues.push('Added missing timezone to timeRange');
  }
  
  // Validate start and end dates
  if (timeRange.start) {
    try {
      new Date(timeRange.start);
    } catch (error) {
      issues.push(`Invalid start date format: ${timeRange.start}`);
    }
  }
  
  if (timeRange.end) {
    try {
      new Date(timeRange.end);
    } catch (error) {
      issues.push(`Invalid end date format: ${timeRange.end}`);
    }
  }
  
  return {
    isValid: issues.length === 0,
    correctedTimeRange,
    issues
  };
}

/**
 * Log timezone debug information in a standardized format
 */
export function logTimezoneDebug(debugInfo: TimezoneDebugInfo): void {
  console.log(`[TIMEZONE DEBUG] ${debugInfo.systemInfo.functionName}:`, JSON.stringify(debugInfo, null, 2));
}