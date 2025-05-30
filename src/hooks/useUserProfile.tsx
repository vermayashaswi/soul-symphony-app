
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface UserProfileData {
  displayName: string | null;
  timezone: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
  stats?: {
    totalEntries: number;
    currentStreak: number;
  };
}

export const useUserProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('display_name, full_name, timezone, avatar_url, created_at')
        .eq('id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      const profileData: UserProfileData = {
        displayName: data?.display_name || null,
        timezone: data?.timezone || null,
        full_name: data?.full_name || null,
        avatar_url: data?.avatar_url || null,
        created_at: data?.created_at || null,
        stats: {
          totalEntries: 0, // This would come from actual journal entries count
          currentStreak: 0 // This would come from actual streak calculation
        }
      };

      setProfile(profileData);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

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
      
      setProfile(prev => prev ? { ...prev, displayName: name } : null);
    } catch (error) {
      console.error('Error updating display name', error);
      throw error;
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
      
      setProfile(prev => prev ? { ...prev, timezone: tz } : null);
    } catch (error) {
      console.error('Error updating timezone', error);
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<UserProfileData>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }
      
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    } catch (error) {
      console.error('Error updating profile', error);
      throw error;
    }
  };

  const refetch = () => {
    fetchProfile();
  };

  return { 
    profile,
    loading,
    error,
    displayName: profile?.displayName,
    timezone: profile?.timezone,
    updateDisplayName,
    updateTimezone,
    updateProfile,
    refetch
  };
};
