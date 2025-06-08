
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ensureProfileExists } from '@/services/profileService';

export interface UserProfileData {
  displayName: string | null;
  timezone: string | null;
}

export const useUserProfile = (): UserProfileData & { 
  updateDisplayName: (name: string) => Promise<void>,
  updateTimezone: (timezone: string) => Promise<void>,
  profile: UserProfileData | null,
  isLoading: boolean,
  error: string | null
} => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // First ensure the profile exists (this will work with our improved trigger)
        const profileExists = await ensureProfileExists(user);
        if (!profileExists) {
          console.error('Failed to ensure profile exists');
          setError('Failed to load profile');
          setIsLoading(false);
          return;
        }

        // Check for local storage name first
        const localName = localStorage.getItem('user_display_name');

        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('display_name, full_name, timezone')
          .eq('id', user.id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error fetching profile', fetchError);
          setError('Failed to load profile');
          setIsLoading(false);
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

        // Set timezone from profile data
        if (data && data.timezone) {
          setTimezone(data.timezone);
        } else {
          // If profile exists but no timezone, update with browser timezone
          const browserTimezone = getBrowserTimezone();
          if (browserTimezone) {
            await updateTimezone(browserTimezone);
            setTimezone(browserTimezone);
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error in profile fetching', error);
        setError('Failed to load profile');
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [user]);

  const getBrowserTimezone = (): string | null => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
      console.error('Error detecting timezone:', error);
      return null;
    }
  };

  const updateDisplayName = async (name: string) => {
    if (!user) return;

    try {
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

  const profile: UserProfileData | null = displayName || timezone ? {
    displayName,
    timezone
  } : null;

  return { 
    displayName, 
    timezone, 
    updateDisplayName, 
    updateTimezone,
    profile,
    isLoading,
    error
  };
};
