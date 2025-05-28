
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface UserProfileData {
  displayName: string | null;
  timezone: string | null;
  is_premium?: boolean | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
}

export const useUserProfile = (): UserProfileData & { 
  updateDisplayName: (name: string) => Promise<void>,
  updateTimezone: (timezone: string) => Promise<void>,
  profile: UserProfileData | null
} => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;

      try {
        const localName = localStorage.getItem('user_display_name');

        const { data, error } = await supabase
          .from('profiles')
          .select('display_name, full_name, timezone, is_premium, subscription_status, trial_ends_at')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching profile', error);
          return;
        }

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
        } else if (user) {
          // If profile exists but no timezone, update with browser timezone
          const browserTimezone = getBrowserTimezone();
          if (browserTimezone) {
            await updateTimezone(browserTimezone);
            setTimezone(browserTimezone);
          }
        }

        // Set subscription data
        if (data) {
          setIsPremium(data.is_premium);
          setSubscriptionStatus(data.subscription_status);
          setTrialEndsAt(data.trial_ends_at);
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

  const profile: UserProfileData = {
    displayName,
    timezone,
    is_premium: isPremium,
    subscription_status: subscriptionStatus,
    trial_ends_at: trialEndsAt
  };

  return { 
    displayName, 
    timezone, 
    is_premium: isPremium,
    subscription_status: subscriptionStatus,
    trial_ends_at: trialEndsAt,
    updateDisplayName, 
    updateTimezone,
    profile
  };
};
