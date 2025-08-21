
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { supabase } from '@/integrations/supabase/client';
import { secureEnsureProfile } from '@/services/secureProfileService';
import { needsTimezoneRevalidation, detectValidatedBrowserTimezone } from '@/services/timezoneService';

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

        // Enhanced timezone handling with validation
        if (data && data.timezone) {
          // Check if stored timezone needs revalidation
          const revalidation = needsTimezoneRevalidation(data.timezone);
          
          if (revalidation.needsUpdate) {
            console.log('[useUserProfile] Timezone needs update:', revalidation.reason);
            await updateTimezone(revalidation.suggestedTimezone);
            setTimezone(revalidation.suggestedTimezone);
          } else {
            setTimezone(data.timezone);
          }
        } else {
          // If profile exists but no timezone, update with validated browser timezone
          const detection = detectValidatedBrowserTimezone();
          console.log('[useUserProfile] Setting timezone for profile without timezone:', detection);
          
          await updateTimezone(detection.timezone);
          setTimezone(detection.timezone);
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

  // Remove old getBrowserTimezone function - using new service instead

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

    try {
      // RLS policies ensure user can only update their own profile
      const { error } = await supabase
        .from('profiles')
        .update({
          timezone: tz,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }
      
      setTimezone(tz);
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
