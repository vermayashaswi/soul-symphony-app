
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { secureEnsureProfile } from '@/services/secureProfileService';

export interface UserProfileData {
  displayName: string | null;
  timezone: string | null;
}

export const useUserProfile = (): UserProfileData & { 
  updateDisplayName: (name: string) => Promise<void>,
  updateTimezone: (timezone: string) => Promise<void>
} => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);

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
          .select('display_name, full_name, timezone')
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
      } catch (error) {
        console.error('Error in profile fetching', error);
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

  return { displayName, timezone, updateDisplayName, updateTimezone };
};
