
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { supabase } from '@/integrations/supabase/client';
import { secureEnsureProfile } from '@/services/secureProfileService';
import { getCountryPrimaryTimezone, normalizeTimezone } from '../../supabase/functions/_shared/timezoneUtils';

export interface UserProfileData {
  displayName: string | null;
  timezone: string | null;
  country: string | null;
}

export const useUserProfile = (): UserProfileData & { 
  updateDisplayName: (name: string) => Promise<void>,
  updateTimezone: (timezone: string) => Promise<void>,
  updateCountry: (country: string) => Promise<void>
} => {
  const { user } = useAuth();
  const { locationData, isLoading: locationLoading } = useLocation();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const countryUpdateAttempted = useRef(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;

      try {
        // First ensure the profile exists using secure RLS-enforced operations
        const profileExists = await secureEnsureProfile(user);
        if (!profileExists) {
          console.error('Failed to ensure profile exists');
          return;
        }

        // Check for local storage name first
        const localName = localStorage.getItem('user_display_name');

        // RLS policies ensure user can only access their own profile
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name, full_name, timezone, country')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching profile', error);
          return;
        }

        // Handle display name priority: local storage > display_name > full_name
        if (localName && (!data || !data.display_name)) {
          await updateDisplayName(localName);
          setDisplayName(localName);
          localStorage.removeItem('user_display_name');
        } else if (data && data.display_name) {
          setDisplayName(data.display_name);
        } else if (data && data.full_name) {
          setDisplayName(data.full_name);
        }

        // Set timezone from profile data with validation
        if (data && data.timezone) {
          const validatedTimezone = validateTimezoneWithCountry(data.timezone, data.country);
          if (validatedTimezone !== data.timezone) {
            console.log(`[useUserProfile] Timezone validation: correcting ${data.timezone} to ${validatedTimezone} for country ${data.country}`);
            await updateTimezone(validatedTimezone);
            setTimezone(validatedTimezone);
          } else {
            setTimezone(data.timezone);
          }
        } else {
          // If profile exists but no timezone, update with browser timezone
          const browserTimezone = getBrowserTimezone();
          if (browserTimezone) {
            await updateTimezone(browserTimezone);
            setTimezone(browserTimezone);
          }
        }

        // Set country from profile data
        if (data && data.country) {
          setCountry(data.country);
        }
      } catch (error) {
        console.error('Error in profile fetching', error);
      }
    };

    fetchUserProfile();
  }, [user]);

  // Auto-update country when it's DEFAULT and LocationContext has detected a valid country
  useEffect(() => {
    const autoUpdateCountry = async () => {
      if (!user || !locationData || locationLoading || countryUpdateAttempted.current) {
        return;
      }

      // Only update if stored country is DEFAULT and detected country is valid (not DEFAULT)
      if (country === 'DEFAULT' && locationData.country !== 'DEFAULT' && locationData.country !== country) {
        console.log('[useUserProfile] Auto-updating country from DEFAULT to:', locationData.country);
        countryUpdateAttempted.current = true;
        await updateCountry(locationData.country);
      }
    };

    autoUpdateCountry();
  }, [user, locationData, locationLoading, country]);

  const getBrowserTimezone = (): string | null => {
    try {
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return normalizeTimezone(browserTimezone);
    } catch (error) {
      console.error('Error detecting timezone:', error);
      return null;
    }
  };

  const validateTimezoneWithCountry = (timezone: string, country: string | null): string => {
    // If no country data, return timezone as-is
    if (!country) return timezone;

    // Get the expected primary timezone for the country
    const expectedTimezone = getCountryPrimaryTimezone(country);
    
    // Special validation: if country is IN (India) but timezone is UTC, correct it
    if (country === 'IN' && timezone === 'UTC') {
      console.log(`[useUserProfile] Timezone/Country mismatch detected: correcting UTC to Asia/Kolkata for India`);
      return 'Asia/Kolkata';
    }

    // For other countries, if timezone is UTC but country has a specific timezone, suggest correction
    if (timezone === 'UTC' && expectedTimezone !== 'UTC') {
      console.log(`[useUserProfile] Timezone/Country mismatch: user has UTC but country ${country} suggests ${expectedTimezone}`);
      return expectedTimezone;
    }

    return timezone;
  };

  const updateDisplayName = async (name: string) => {
    if (!user) return;

    try {
      // RLS policies ensure user can only update their own profile
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: name,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }
      
      setDisplayName(name);
    } catch (error) {
      console.error('Error updating display name', error);
    }
  };

  const updateTimezone = async (tz: string) => {
    if (!user) return;

    // Normalize and validate the timezone
    const normalizedTimezone = normalizeTimezone(tz);
    const validatedTimezone = validateTimezoneWithCountry(normalizedTimezone, country);
    
    console.log(`[useUserProfile] Updating timezone: ${tz} -> ${normalizedTimezone} -> ${validatedTimezone}`);

    try {
      // RLS policies ensure user can only update their own profile
      const { error } = await supabase
        .from('profiles')
        .update({
          timezone: validatedTimezone,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }
      
      setTimezone(validatedTimezone);
      console.log(`[useUserProfile] Timezone updated successfully to: ${validatedTimezone}`);
    } catch (error) {
      console.error('Error updating timezone', error);
    }
  };

  const updateCountry = async (countryCode: string) => {
    if (!user) return;

    try {
      // RLS policies ensure user can only update their own profile
      const { error } = await supabase
        .from('profiles')
        .update({
          country: countryCode,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }
      
      setCountry(countryCode);
      console.log('[useUserProfile] Country updated successfully to:', countryCode);
    } catch (error) {
      console.error('Error updating country', error);
    }
  };

  return { displayName, timezone, country, updateDisplayName, updateTimezone, updateCountry };
};
