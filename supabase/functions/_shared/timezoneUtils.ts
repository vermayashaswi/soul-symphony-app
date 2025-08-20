/**
 * Timezone normalization utilities
 * Ensures consistent timezone format across all edge functions
 */

// Comprehensive legacy timezone mappings to modern IANA identifiers
// Covers all 24 supported countries in our pricing system
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
    console.log('[timezoneUtils] No timezone provided, defaulting to UTC');
    return 'UTC';
  }

  const trimmedTimezone = timezone.trim();
  
  // Check if it's a legacy timezone that needs mapping
  if (LEGACY_TIMEZONE_MAP[trimmedTimezone]) {
    const normalized = LEGACY_TIMEZONE_MAP[trimmedTimezone];
    console.log(`[timezoneUtils] Normalized legacy timezone: ${trimmedTimezone} -> ${normalized}`);
    return normalized;
  }

  // Validate timezone format (basic IANA timezone validation)
  if (isValidIANATimezone(trimmedTimezone)) {
    return trimmedTimezone;
  }

  console.warn(`[timezoneUtils] Invalid timezone format: ${trimmedTimezone}, defaulting to UTC`);
  return 'UTC';
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
 * Get country-specific primary timezone mappings for all 24 supported countries
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

/**
 * Gets the current browser timezone in normalized format
 */
export function getNormalizedBrowserTimezone(): string {
  try {
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return normalizeTimezone(browserTimezone);
  } catch (error) {
    console.error('[timezoneUtils] Error detecting browser timezone:', error);
    return 'UTC';
  }
}

/**
 * Normalizes user profile timezone data
 */
export function normalizeUserTimezone(userProfile: any): string {
  const timezone = userProfile?.timezone || userProfile?.user_timezone;
  const normalized = normalizeTimezone(timezone);
  
  if (timezone && timezone !== normalized) {
    console.log(`[timezoneUtils] User timezone normalized: ${timezone} -> ${normalized}`);
  }
  
  return normalized;
}