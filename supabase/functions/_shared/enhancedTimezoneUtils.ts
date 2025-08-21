/**
 * Enhanced timezone utilities with comprehensive error handling and validation
 * Fixes timezone conversion issues across edge functions
 */

import { normalizeTimezone } from './timezoneUtils.ts';

/**
 * Enhanced timezone conversion with validation and error handling
 */
export function safeTimezoneConversion(
  timezone: string | null | undefined,
  options: {
    fallbackToUTC?: boolean;
    includeValidation?: boolean;
    logFailures?: boolean;
    functionName?: string;
  } = {}
): {
  normalizedTimezone: string;
  currentTime: string;
  currentHour: number;
  isValid: boolean;
  conversionError?: string;
  rawUtcTime?: string;
} {
  const {
    fallbackToUTC = true,
    includeValidation = true,
    logFailures = true,
    functionName = 'unknown'
  } = options;

  // Normalize the timezone first
  const normalizedTimezone = normalizeTimezone(timezone);
  
  // Default return values
  let currentTime = '';
  let currentHour = 0;
  let isValid = false;
  let conversionError: string | undefined;
  let rawUtcTime: string | undefined;

  try {
    const now = new Date();
    rawUtcTime = now.toISOString();
    
    // Log the conversion attempt
    if (logFailures) {
      console.log(`[${functionName}] Timezone conversion attempt:`, {
        originalTimezone: timezone,
        normalizedTimezone,
        utcTime: rawUtcTime,
        timestamp: new Date().toISOString()
      });
    }

    // Attempt timezone conversion with comprehensive error handling
    try {
      // Method 1: Try toLocaleString with timezone
      currentTime = now.toLocaleString('en-US', {
        timeZone: normalizedTimezone,
        weekday: 'long',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      // Get hour separately for validation
      currentHour = parseInt(now.toLocaleString('en-US', {
        timeZone: normalizedTimezone,
        hour: 'numeric',
        hour12: false
      }));

      // Validate the conversion worked
      if (includeValidation) {
        if (!currentTime || currentTime.includes('Invalid') || isNaN(currentHour)) {
          throw new Error(`Invalid conversion result: time="${currentTime}", hour=${currentHour}`);
        }
        
        // Additional validation: check if hour is reasonable (0-23)
        if (currentHour < 0 || currentHour > 23) {
          throw new Error(`Invalid hour result: ${currentHour}`);
        }
      }

      isValid = true;
      
      if (logFailures) {
        console.log(`[${functionName}] Timezone conversion successful:`, {
          normalizedTimezone,
          currentTime,
          currentHour,
          utcTime: rawUtcTime
        });
      }

    } catch (conversionErr) {
      conversionError = conversionErr instanceof Error ? conversionErr.message : 'Unknown conversion error';
      
      if (logFailures) {
        console.error(`[${functionName}] Timezone conversion failed:`, {
          normalizedTimezone,
          error: conversionError,
          utcTime: rawUtcTime
        });
      }

      // Fallback to UTC if enabled
      if (fallbackToUTC) {
        try {
          currentTime = now.toLocaleString('en-US', {
            timeZone: 'UTC',
            weekday: 'long',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }) + ' (UTC fallback)';
          
          currentHour = parseInt(now.toLocaleString('en-US', {
            timeZone: 'UTC',
            hour: 'numeric',
            hour12: false
          }));
          
          if (logFailures) {
            console.log(`[${functionName}] UTC fallback successful:`, {
              currentTime,
              currentHour
            });
          }
        } catch (fallbackErr) {
          // Ultimate fallback - use raw date methods
          currentTime = `${now.getUTCHours()}:${now.getUTCMinutes().toString().padStart(2, '0')} UTC (raw fallback)`;
          currentHour = now.getUTCHours();
          
          if (logFailures) {
            console.error(`[${functionName}] UTC fallback also failed, using raw methods:`, {
              fallbackError: fallbackErr instanceof Error ? fallbackErr.message : 'Unknown fallback error',
              currentTime,
              currentHour
            });
          }
        }
      }
    }

  } catch (generalError) {
    conversionError = generalError instanceof Error ? generalError.message : 'Unknown general error';
    
    if (logFailures) {
      console.error(`[${functionName}] General timezone conversion error:`, {
        error: conversionError,
        timezone,
        normalizedTimezone
      });
    }

    // Ultimate fallback
    const now = new Date();
    currentTime = `${now.getUTCHours()}:${now.getUTCMinutes().toString().padStart(2, '0')} UTC (error fallback)`;
    currentHour = now.getUTCHours();
  }

  return {
    normalizedTimezone,
    currentTime,
    currentHour,
    isValid,
    conversionError,
    rawUtcTime
  };
}

/**
 * Format timezone for GPT prompts with consistent format
 */
export function formatTimezoneForGPT(
  timezone: string | null | undefined,
  options: {
    includeUTCOffset?: boolean;
    functionName?: string;
  } = {}
): {
  timezoneText: string;
  currentTimeText: string;
  validationNotes: string[];
} {
  const { includeUTCOffset = false, functionName = 'unknown' } = options;
  
  const conversion = safeTimezoneConversion(timezone, {
    functionName,
    includeValidation: true,
    logFailures: true
  });

  const validationNotes: string[] = [];
  
  if (!conversion.isValid) {
    validationNotes.push(`Timezone conversion failed: ${conversion.conversionError}`);
  }
  
  if (conversion.currentTime.includes('fallback')) {
    validationNotes.push('Using fallback timezone conversion');
  }

  let timezoneText = `${conversion.normalizedTimezone}`;
  
  if (includeUTCOffset) {
    try {
      const now = new Date();
      const utcTime = now.getTime();
      const localTime = new Date(now.toLocaleString('en-US', { timeZone: conversion.normalizedTimezone })).getTime();
      const offsetMinutes = (localTime - utcTime) / (1000 * 60);
      const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
      const offsetMins = Math.abs(offsetMinutes) % 60;
      const sign = offsetMinutes >= 0 ? '+' : '-';
      timezoneText += ` (UTC${sign}${offsetHours.toString().padStart(2, '0')}:${offsetMins.toString().padStart(2, '0')})`;
    } catch (err) {
      validationNotes.push('Could not calculate UTC offset');
    }
  }

  const currentTimeText = `Current user time: ${conversion.currentTime}`;

  return {
    timezoneText,
    currentTimeText,
    validationNotes
  };
}

/**
 * Validate timezone string format
 */
export function validateTimezoneFormat(timezone: string): {
  isValid: boolean;
  normalizedTimezone: string;
  issues: string[];
} {
  const issues: string[] = [];
  
  if (!timezone) {
    issues.push('Timezone is empty or null');
    return { isValid: false, normalizedTimezone: 'UTC', issues };
  }

  const normalizedTimezone = normalizeTimezone(timezone);
  
  // Test if the timezone actually works
  try {
    const testDate = new Date();
    const result = testDate.toLocaleString('en-US', { timeZone: normalizedTimezone });
    
    if (!result || result.includes('Invalid')) {
      issues.push(`Timezone conversion test failed: ${result}`);
      return { isValid: false, normalizedTimezone, issues };
    }
  } catch (err) {
    issues.push(`Timezone test error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    return { isValid: false, normalizedTimezone, issues };
  }

  return { isValid: true, normalizedTimezone, issues };
}

/**
 * Debug timezone information
 */
export function debugTimezoneInfo(
  timezone: string | null | undefined,
  functionName: string = 'debug'
): Record<string, any> {
  const conversion = safeTimezoneConversion(timezone, {
    functionName,
    includeValidation: true,
    logFailures: false  // Don't spam logs for debug
  });

  const validation = validateTimezoneFormat(conversion.normalizedTimezone);
  
  const debugInfo = {
    input: {
      originalTimezone: timezone,
      normalizedTimezone: conversion.normalizedTimezone
    },
    conversion: {
      isValid: conversion.isValid,
      currentTime: conversion.currentTime,
      currentHour: conversion.currentHour,
      error: conversion.conversionError,
      rawUtcTime: conversion.rawUtcTime
    },
    validation: {
      isValid: validation.isValid,
      issues: validation.issues
    },
    systemInfo: {
      functionName,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server-side'
    }
  };

  console.log(`[TIMEZONE DEBUG] ${functionName}:`, debugInfo);
  
  return debugInfo;
}