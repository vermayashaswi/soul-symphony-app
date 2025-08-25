import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

/**
 * Secure hook for profile access that ensures proper authentication
 * and RLS enforcement. Only allows access to the current user's profile.
 */
export const useSecureProfileAccess = () => {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSecureProfile = async () => {
    if (!user) {
      setProfileData(null);
      setError('No authenticated user');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // RLS policies ensure user can only access their own profile
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id' as any, user.id as any)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      setProfileData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch profile');
      console.error('Secure profile access error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSecureProfile = async (updates: Record<string, any>) => {
    if (!user) {
      throw new Error('No authenticated user');
    }

    // RLS policies ensure user can only update their own profile
    const { error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      } as any)
      .eq('id' as any, user.id as any);

    if (error) {
      throw error;
    }

    // Refresh profile data after update
    await fetchSecureProfile();
  };

  useEffect(() => {
    fetchSecureProfile();
  }, [user]);

  return {
    profileData,
    isLoading,
    error,
    refreshProfile: fetchSecureProfile,
    updateProfile: updateSecureProfile
  };
};