/**
 * Enhanced timezone utilities specifically for edge functions
 * Provides comprehensive validation and error handling for timezone processing in edge functions
 */

import { normalizeTimezone } from './timezoneUtils.ts';

/**
 * Enhanced timezone processing for edge functions with pre-validation
 */
export function processEdgeTimezone(
  timezone: string | null | undefined,
  functionName: string = 'unknown-edge-function'
): {
  normalizedTimezone: string;
  currentTime: string;
  currentHour: number;
  isValid: boolean;
  validationError?: string;
  debugInfo: Record<string, any>;
} {
  const debugInfo: Record<string, any> = {
    functionName,
    inputTimezone: timezone,
    timestamp: new Date().toISOString()
  };

  // Step 1: Normalize timezone
  const normalizedTimezone = normalizeTimezone(timezone);
  debugInfo.normalizedTimezone = normalizedTimezone;

  // Step 2: Pre-validate timezone before conversion
  const preValidation = validateTimezoneForEdge(normalizedTimezone);
  debugInfo.preValidation = preValidation;

  if (!preValidation.isValid) {
    console.error(`[${functionName}] Timezone pre-validation failed:`, preValidation);
    return {
      normalizedTimezone: 'UTC',
      currentTime: 'UTC (validation failed)',
      currentHour: new Date().getUTCHours(),
      isValid: false,
      validationError: preValidation.error,
      debugInfo
    };
  }

  // Step 3: Attempt safe conversion
  try {
    const now = new Date();
    debugInfo.utcTime = now.toISOString();

    // Enhanced conversion with multiple fallback methods
    const conversionResult = performTimezoneConversion(now, normalizedTimezone, functionName);
    debugInfo.conversionResult = conversionResult;

    if (conversionResult.success) {
      console.log(`[${functionName}] Timezone conversion successful:`, {
        timezone: normalizedTimezone,
        currentTime: conversionResult.formattedTime,
        hour: conversionResult.hour
      });

      return {
        normalizedTimezone,
        currentTime: conversionResult.formattedTime,
        currentHour: conversionResult.hour,
        isValid: true,
        debugInfo
      };
    } else {
      throw new Error(conversionResult.error);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown conversion error';
    console.error(`[${functionName}] Timezone conversion failed:`, {
      timezone: normalizedTimezone,
      error: errorMessage,
      debugInfo
    });

    // Ultimate fallback to UTC
    const utcTime = new Date();
    return {
      normalizedTimezone: 'UTC',
      currentTime: `${utcTime.getUTCHours()}:${utcTime.getUTCMinutes().toString().padStart(2, '0')} UTC (fallback)`,
      currentHour: utcTime.getUTCHours(),
      isValid: false,
      validationError: `Conversion failed: ${errorMessage}`,
      debugInfo
    };
  }
}

/**
 * Validate timezone specifically for edge function usage
 */
function validateTimezoneForEdge(timezone: string): {
  isValid: boolean;
  error?: string;
} {
  if (!timezone) {
    return { isValid: false, error: 'Timezone is null or empty' };
  }

  // Basic IANA format check
  const ianaPattern = /^(UTC|[A-Z][a-z]+\/[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)?)$/;
  if (!ianaPattern.test(timezone)) {
    return { isValid: false, error: `Invalid IANA timezone format: ${timezone}` };
  }

  // Test conversion capability
  try {
    const testDate = new Date();
    const testResult = testDate.toLocaleString('en-US', { timeZone: timezone });
    
    if (!testResult || testResult.includes('Invalid')) {
      return { isValid: false, error: `Timezone conversion test failed: ${testResult}` };
    }
  } catch (err) {
    return { 
      isValid: false, 
      error: `Timezone test error: ${err instanceof Error ? err.message : 'Unknown error'}` 
    };
  }

  return { isValid: true };
}

/**
 * Perform timezone conversion with multiple fallback methods
 */
function performTimezoneConversion(
  date: Date,
  timezone: string,
  functionName: string
): {
  success: boolean;
  formattedTime?: string;
  hour?: number;
  error?: string;
} {
  // Method 1: Standard toLocaleString
  try {
    const formattedTime = date.toLocaleString('en-US', {
      timeZone: timezone,
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const hour = parseInt(date.toLocaleString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false
    }));

    // Validate results
    if (!formattedTime || formattedTime.includes('Invalid') || isNaN(hour) || hour < 0 || hour > 23) {
      throw new Error(`Invalid conversion result: time="${formattedTime}", hour=${hour}`);
    }

    return { success: true, formattedTime, hour };
  } catch (err) {
    console.warn(`[${functionName}] Method 1 failed:`, err);
  }

  // Method 2: Alternative format
  try {
    const hour = parseInt(date.toLocaleString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false
    }));
    
    const minute = parseInt(date.toLocaleString('en-US', {
      timeZone: timezone,
      minute: 'numeric'
    }));

    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new Error(`Invalid time components: hour=${hour}, minute=${minute}`);
    }

    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const formattedTime = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;

    return { success: true, formattedTime, hour };
  } catch (err) {
    console.warn(`[${functionName}] Method 2 failed:`, err);
  }

  return { 
    success: false, 
    error: 'All conversion methods failed' 
  };
}

/**
 * Create optimized timezone text for GPT prompts
 */
export function createGPTTimezonePrompt(
  timezone: string | null | undefined,
  functionName: string = 'edge-function'
): {
  timezonePrompt: string;
  validationNotes: string[];
  debugInfo: Record<string, any>;
} {
  const processing = processEdgeTimezone(timezone, functionName);
  const validationNotes: string[] = [];

  if (!processing.isValid) {
    validationNotes.push(`Timezone processing failed: ${processing.validationError}`);
  }

  if (processing.currentTime.includes('fallback')) {
    validationNotes.push('Using UTC fallback due to timezone conversion failure');
  }

  // Create explicit timezone prompt for GPT
  const timezonePrompt = `IMPORTANT TIMEZONE CONTEXT:
- User's timezone: ${processing.normalizedTimezone}
- Current user time: ${processing.currentTime}
- Current user hour: ${processing.currentHour}
${validationNotes.length > 0 ? `- Validation notes: ${validationNotes.join(', ')}` : ''}

When responding about time, dates, or time-sensitive topics, ALWAYS use the user's timezone (${processing.normalizedTimezone}) and current time (${processing.currentTime}). Do not assume UTC or any other timezone.`;

  console.log(`[${functionName}] Generated GPT timezone prompt:`, {
    timezone: processing.normalizedTimezone,
    currentTime: processing.currentTime,
    isValid: processing.isValid,
    validationNotes
  });

  return {
    timezonePrompt,
    validationNotes,
    debugInfo: processing.debugInfo
  };
}