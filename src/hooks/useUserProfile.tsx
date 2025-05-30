
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ensureProfileExists } from '@/services/profileService';

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  is_premium: boolean | null;
  onboarding_completed: boolean | null;
  created_at: string;
  updated_at: string;
}

export const useUserProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // First ensure the profile exists
        const profileExists = await ensureProfileExists(user);
        if (!profileExists) {
          setError('Failed to ensure profile exists');
          return;
        }

        // Fetch the profile data
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        setProfile(data);
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [user]);

  const updateProfileField = async (field: string, value: any) => {
    if (!user || !profile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          [field]: value,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }
      
      // Update local state
      setProfile(prev => prev ? { ...prev, [field]: value } : null);
    } catch (err) {
      console.error(`Error updating ${field}:`, err);
      throw err;
    }
  };

  return { 
    profile, 
    isLoading, 
    error, 
    updateProfileField 
  };
};
