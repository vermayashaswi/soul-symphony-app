
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useOnboarding() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const checkOnboardingStatus = useCallback(() => {
    console.log('[useOnboarding] Checking onboarding status...');
    
    try {
      // Check if onboarding is complete
      const isComplete = localStorage.getItem('onboardingComplete') === 'true';
      console.log('[useOnboarding] LocalStorage onboarding status:', isComplete);
      
      setOnboardingComplete(isComplete);
      
      // Check if there's a name set during onboarding
      const name = localStorage.getItem('user_display_name');
      if (name) {
        console.log('[useOnboarding] Found display name:', name);
        setDisplayName(name);
      }
      
      setLoading(false);
      console.log('[useOnboarding] Status check complete');
    } catch (error) {
      console.error('[useOnboarding] Error checking onboarding status:', error);
      setOnboardingComplete(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('[useOnboarding] Hook initializing...');
    checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  const completeOnboarding = useCallback(() => {
    console.log('[useOnboarding] Completing onboarding...');
    try {
      localStorage.setItem('onboardingComplete', 'true');
      setOnboardingComplete(true);
      console.log('[useOnboarding] Onboarding marked as complete');
    } catch (error) {
      console.error('[useOnboarding] Error completing onboarding:', error);
    }
  }, []);

  const resetOnboarding = useCallback(() => {
    console.log('[useOnboarding] Resetting onboarding...');
    try {
      localStorage.removeItem('onboardingComplete');
      setOnboardingComplete(false);
      console.log('[useOnboarding] Onboarding reset');
    } catch (error) {
      console.error('[useOnboarding] Error resetting onboarding:', error);
    }
  }, []);

  const saveNameToProfile = useCallback(async (userId: string, name: string) => {
    console.log('[useOnboarding] Saving name to profile:', { userId, name });
    
    if (!userId || !name) {
      console.warn('[useOnboarding] Missing userId or name');
      return;
    }
    
    try {
      // Save the name to the profile
      const { error } = await supabase
        .from('profiles')
        .update({ 
          display_name: name,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (error) {
        console.error('[useOnboarding] Error saving display name to profile:', error);
      } else {
        console.log('[useOnboarding] Display name saved successfully');
        // Clear from localStorage after successful save
        localStorage.removeItem('user_display_name');
      }
    } catch (error) {
      console.error('[useOnboarding] Error in saving display name:', error);
    }
  }, []);

  console.log('[useOnboarding] Current state:', {
    onboardingComplete,
    loading,
    displayName
  });

  return {
    onboardingComplete: onboardingComplete ?? false,
    loading,
    displayName,
    completeOnboarding,
    resetOnboarding,
    saveNameToProfile,
    checkOnboardingStatus
  };
}
