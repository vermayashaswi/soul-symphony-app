
import React from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Utility to ensure user profile exists and is properly initialized
 */
export async function initializeUserProfile(userId: string): Promise<boolean> {
  try {
    console.log('[ProfileInitializer] Initializing profile for user:', userId);
    
    // First check if profile exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id, onboarding_completed')
      .eq('id', userId)
      .single();
      
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[ProfileInitializer] Error checking profile:', checkError);
      return false;
    }
    
    // If profile exists, we're good
    if (existingProfile) {
      console.log('[ProfileInitializer] Profile already exists');
      return true;
    }
    
    // Profile doesn't exist, create it
    console.log('[ProfileInitializer] Creating new profile');
    
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('[ProfileInitializer] Error getting user data:', userError);
      return false;
    }
    
    const { error: insertError } = await supabase
      .from('profiles')
      .insert([{
        id: userId,
        email: userData.user?.email,
        full_name: userData.user?.user_metadata?.full_name || '',
        avatar_url: userData.user?.user_metadata?.avatar_url || '',
        onboarding_completed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);
      
    if (insertError) {
      // Handle case where profile was created by another process
      if (insertError.code === '23505') {
        console.log('[ProfileInitializer] Profile already exists (race condition)');
        return true;
      }
      console.error('[ProfileInitializer] Error creating profile:', insertError);
      return false;
    }
    
    console.log('[ProfileInitializer] Profile created successfully');
    return true;
    
  } catch (error) {
    console.error('[ProfileInitializer] Exception:', error);
    return false;
  }
}

/**
 * Hook to automatically initialize user profile on auth
 */
export function useProfileInitialization(userId: string | undefined) {
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [isInitializing, setIsInitializing] = React.useState(false);
  
  React.useEffect(() => {
    if (userId && !isInitialized && !isInitializing) {
      setIsInitializing(true);
      initializeUserProfile(userId)
        .then((success) => {
          setIsInitialized(success);
        })
        .finally(() => {
          setIsInitializing(false);
        });
    }
  }, [userId, isInitialized, isInitializing]);
  
  return { isInitialized, isInitializing };
}
