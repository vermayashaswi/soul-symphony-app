/**
 * Enhanced timezone service for consistent timezone handling
 */

// Comprehensive legacy timezone mappings to modern IANA identifiers
const LEGACY_TIMEZONE_MAP: Record<string, string> = {
  // India
  'Asia/Calcutta': 'Asia/Kolkata',
  
  // United States (multiple zones)
  'US/Eastern': 'America/New_York',
  'US/Central': 'America/Chicago',
  'US/Mountain': 'America/Denver',
  'US/Pacific': 'America/Los_Angeles',
  'US/Alaska': 'America/Anchorage',
  'US/Hawaii': 'Pacific/Honolulu',
  'EST': 'America/New_York',
  'CST': 'America/Chicago',
  'MST': 'America/Denver',
  'PST': 'America/Los_Angeles',
  'EDT': 'America/New_York',
  'CDT': 'America/Chicago',
  'MDT': 'America/Denver',
  'PDT': 'America/Los_Angeles',
  
  // Canada (multiple zones)
  'Canada/Eastern': 'America/Toronto',
  'Canada/Central': 'America/Winnipeg',
  'Canada/Mountain': 'America/Edmonton',
  'Canada/Pacific': 'America/Vancouver',
  'Canada/Atlantic': 'America/Halifax',
  
  // Europe
  'Europe/Kiev': 'Europe/Kyiv',
  'CET': 'Europe/Berlin',
  'EET': 'Europe/Athens',
  'WET': 'Europe/London',
  'CEST': 'Europe/Berlin',
  'EEST': 'Europe/Athens',
  'WEST': 'Europe/London',
  
  // Australia (multiple zones)
  'Australia/ACT': 'Australia/Sydney',
  'Australia/NSW': 'Australia/Sydney',
  'Australia/Victoria': 'Australia/Melbourne',
  'Australia/Queensland': 'Australia/Brisbane',
  'Australia/South': 'Australia/Adelaide',
  'Australia/West': 'Australia/Perth',
  'Australia/Tasmania': 'Australia/Hobart',
  'Australia/North': 'Australia/Darwin',
  'AEST': 'Australia/Sydney',
  'AEDT': 'Australia/Sydney',
  'AWST': 'Australia/Perth',
  'ACST': 'Australia/Adelaide',
  'ACDT': 'Australia/Adelaide',
  
  // Asia
  'JST': 'Asia/Tokyo',
  'KST': 'Asia/Seoul',
  'SGT': 'Asia/Singapore',
  'MYT': 'Asia/Kuala_Lumpur',
  'ICT': 'Asia/Bangkok',
  'GST': 'Asia/Dubai',
  'AST': 'Asia/Riyadh',
  
  // Mexico (multiple zones)
  'Mexico/General': 'America/Mexico_City',
  'Mexico/BajaNorte': 'America/Tijuana',
  'Mexico/BajaSur': 'America/Mazatlan',
  
  // Brazil (multiple zones)
  'Brazil/East': 'America/Sao_Paulo',
  'Brazil/West': 'America/Manaus',
  'Brazil/Acre': 'America/Rio_Branco',
  'BRT': 'America/Sao_Paulo',
  'BRST': 'America/Sao_Paulo',
  
  // Africa
  'CAT': 'Africa/Johannesburg',
  'WAT': 'Africa/Lagos',
  'SAST': 'Africa/Johannesburg',
  
  // GMT variations
  'GMT': 'UTC',
  'GMT+0': 'UTC',
  'GMT-0': 'UTC',
  'UTC+0': 'UTC',
  'UTC-0': 'UTC',
  'Z': 'UTC',
  
  // Common abbreviations
  'BST': 'Europe/London',
  'IST': 'Asia/Kolkata',
  'PKT': 'Asia/Karachi',
  'NPT': 'Asia/Kathmandu',
  'LKT': 'Asia/Colombo',
};

/**
 * Normalizes a timezone string to modern IANA format
 */
export function normalizeTimezone(timezone: string | null | undefined): string {
  if (!timezone) {
    console.log('[timezoneService] No timezone provided, defaulting to UTC');
    return 'UTC';
  }

  const trimmedTimezone = timezone.trim();
  
  // Check if it's a legacy timezone that needs mapping
  if (LEGACY_TIMEZONE_MAP[trimmedTimezone]) {
    const normalized = LEGACY_TIMEZONE_MAP[trimmedTimezone];
    console.log(`[timezoneService] Normalized legacy timezone: ${trimmedTimezone} -> ${normalized}`);
    return normalized;
  }

  // Validate timezone format (basic IANA timezone validation)
  if (isValidIANATimezone(trimmedTimezone)) {
    return trimmedTimezone;
  }

  console.warn(`[timezoneService] Invalid timezone format: ${trimmedTimezone}, defaulting to UTC`);
  return 'UTC';
}

/**
 * Enhanced timezone format validation with actual conversion test
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
  
  // Test if the timezone actually works with JavaScript's Date API
  try {
    const testDate = new Date();
    const result = testDate.toLocaleString('en-US', { timeZone: normalizedTimezone });
    
    if (!result || result.includes('Invalid')) {
      issues.push(`Timezone conversion test failed: ${result}`);
      return { isValid: false, normalizedTimezone, issues };
    }
    
    // Additional test: try to get hour to ensure conversion works
    const hour = parseInt(testDate.toLocaleString('en-US', {
      timeZone: normalizedTimezone,
      hour: 'numeric',
      hour12: false
    }));
    
    if (isNaN(hour) || hour < 0 || hour > 23) {
      issues.push(`Invalid hour result from timezone conversion: ${hour}`);
      return { isValid: false, normalizedTimezone, issues };
    }
    
  } catch (err) {
    issues.push(`Timezone test error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    return { isValid: false, normalizedTimezone, issues };
  }

  return { isValid: true, normalizedTimezone, issues };
}

/**
 * Enhanced browser timezone detection with validation
 */
export function detectValidatedBrowserTimezone(): {
  timezone: string;
  isValid: boolean;
  issues: string[];
} {
  try {
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log('[timezoneService] Detected browser timezone:', browserTimezone);
    
    const normalized = normalizeTimezone(browserTimezone);
    const validation = validateTimezoneFormat(normalized);
    
    return {
      timezone: validation.normalizedTimezone,
      isValid: validation.isValid,
      issues: validation.issues
    };
  } catch (error) {
    console.error('[timezoneService] Browser timezone detection error:', error);
    return {
      timezone: 'UTC',
      isValid: false,
      issues: [`Browser detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Check if timezone needs re-validation (suspicious UTC or legacy formats)
 */
export function needsTimezoneRevalidation(storedTimezone: string | null): {
  needsUpdate: boolean;
  suggestedTimezone: string;
  reason: string;
} {
  if (!storedTimezone) {
    const detected = detectValidatedBrowserTimezone();
    return {
      needsUpdate: true,
      suggestedTimezone: detected.timezone,
      reason: 'No timezone stored in profile'
    };
  }
  
  // Check if stored timezone is suspicious UTC when browser isn't UTC
  const browserDetection = detectValidatedBrowserTimezone();
  if (storedTimezone === 'UTC' && browserDetection.timezone !== 'UTC' && browserDetection.isValid) {
    return {
      needsUpdate: true,
      suggestedTimezone: browserDetection.timezone,
      reason: 'Stored UTC timezone but browser suggests different timezone'
    };
  }
  
  // Check if stored timezone is legacy format
  const normalized = normalizeTimezone(storedTimezone);
  if (normalized !== storedTimezone) {
    return {
      needsUpdate: true,
      suggestedTimezone: normalized,
      reason: 'Legacy timezone format detected'
    };
  }
  
  // Check if stored timezone is valid
  const validation = validateTimezoneFormat(storedTimezone);
  if (!validation.isValid) {
    return {
      needsUpdate: true,
      suggestedTimezone: browserDetection.timezone,
      reason: `Invalid timezone format: ${validation.issues.join(', ')}`
    };
  }
  
  return {
    needsUpdate: false,
    suggestedTimezone: storedTimezone,
    reason: 'Timezone is valid and current'
  };
}

/**
 * Basic validation for IANA timezone format
 */
function isValidIANATimezone(timezone: string): boolean {
  // Enhanced pattern check for IANA timezone: Area/Location or UTC
  const ianaPattern = /^(UTC|[A-Z][a-z]+\/[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)?)$/;
  return ianaPattern.test(timezone);
}

/**
 * Get country-specific primary timezone mappings
 */
export function getCountryPrimaryTimezone(countryCode: string): string {
  const COUNTRY_TIMEZONE_MAP: Record<string, string> = {
    'IN': 'Asia/Kolkata',           // India
    'US': 'America/New_York',       // United States (Eastern as primary)
    'GB': 'Europe/London',          // United Kingdom
    'CA': 'America/Toronto',        // Canada (Eastern as primary)
    'AU': 'Australia/Sydney',       // Australia (Eastern as primary)
    'DE': 'Europe/Berlin',          // Germany
    'FR': 'Europe/Paris',           // France
    'IT': 'Europe/Rome',            // Italy
    'ES': 'Europe/Madrid',          // Spain
    'NL': 'Europe/Amsterdam',       // Netherlands
    'SE': 'Europe/Stockholm',       // Sweden
    'NO': 'Europe/Oslo',            // Norway
    'DK': 'Europe/Copenhagen',      // Denmark
    'AE': 'Asia/Dubai',             // UAE
    'SA': 'Asia/Riyadh',            // Saudi Arabia
    'JP': 'Asia/Tokyo',             // Japan
    'KR': 'Asia/Seoul',             // South Korea
    'SG': 'Asia/Singapore',         // Singapore
    'MY': 'Asia/Kuala_Lumpur',      // Malaysia
    'TH': 'Asia/Bangkok',           // Thailand
    'MX': 'America/Mexico_City',    // Mexico
    'BR': 'America/Sao_Paulo',      // Brazil
    'ZA': 'Africa/Johannesburg',    // South Africa
    'NG': 'Africa/Lagos',           // Nigeria
    'DEFAULT': 'UTC'                // Default fallback
  };
  
  return COUNTRY_TIMEZONE_MAP[countryCode] || COUNTRY_TIMEZONE_MAP['DEFAULT'];
}