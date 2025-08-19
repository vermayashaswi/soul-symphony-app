/**
 * Timezone normalization utilities
 * Ensures consistent timezone format across all edge functions
 */

// Legacy timezone mappings to modern IANA identifiers
const LEGACY_TIMEZONE_MAP: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'US/Eastern': 'America/New_York',
  'US/Central': 'America/Chicago',
  'US/Mountain': 'America/Denver',
  'US/Pacific': 'America/Los_Angeles',
  'US/Alaska': 'America/Anchorage',
  'US/Hawaii': 'Pacific/Honolulu',
  'Europe/Kiev': 'Europe/Kyiv',
  'GMT': 'UTC',
  'GMT+0': 'UTC',
  'GMT-0': 'UTC',
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
  // Basic pattern check for IANA timezone: Area/Location or UTC
  const ianaPattern = /^(UTC|[A-Z][a-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?)$/;
  return ianaPattern.test(timezone);
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