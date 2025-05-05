
import { supabase } from '@/integrations/supabase/client';

/**
 * Gets the user's current timezone from their browser
 */
export function getCurrentTimezone(): {name: string, offset: number} {
  try {
    // Get timezone name from browser
    const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Calculate current offset in minutes
    const now = new Date();
    const offsetInMinutes = now.getTimezoneOffset() * -1; // getTimezoneOffset returns negative minutes
    
    return {
      name: timezoneName,
      offset: offsetInMinutes
    };
  } catch (error) {
    console.error("Error detecting timezone:", error);
    // Default to UTC if detection fails
    return {
      name: "UTC",
      offset: 0
    };
  }
}

/**
 * Saves the user's timezone to their profile
 */
export async function saveUserTimezone(userId: string): Promise<boolean> {
  if (!userId) return false;
  
  try {
    const { name: timezone } = getCurrentTimezone();
    
    const { error } = await supabase
      .from('profiles')
      .update({ timezone })
      .eq('id', userId);
    
    if (error) {
      console.error("Error saving timezone:", error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error in saveUserTimezone:", error);
    return false;
  }
}

/**
 * Gets the user's saved timezone from their profile
 */
export async function getUserTimezone(userId: string): Promise<string | null> {
  if (!userId) return null;
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .single();
    
    if (error || !data) {
      console.error("Error fetching user timezone:", error);
      return null;
    }
    
    return data.timezone;
  } catch (error) {
    console.error("Error in getUserTimezone:", error);
    return null;
  }
}

/**
 * Formats a UTC date to the user's local timezone
 */
export function formatToLocalTimezone(
  date: Date | string,
  format: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  },
  timezone?: string
): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Use provided timezone or default to browser's timezone
    const timezoneName = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    return new Intl.DateTimeFormat('en-US', {
      ...format,
      timeZone: timezoneName
    }).format(dateObj);
  } catch (error) {
    console.error("Error formatting date with timezone:", error);
    // Fallback to simple formatting
    return new Date(date).toLocaleString();
  }
}

/**
 * Creates an ISO string with timezone information
 */
export function createLocalTimestamp(): {
  isoString: string,
  timezoneName: string,
  timezoneOffset: number
} {
  const now = new Date();
  const { name, offset } = getCurrentTimezone();
  
  return {
    isoString: now.toISOString(),
    timezoneName: name,
    timezoneOffset: offset
  };
}
