
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useOnboarding() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const checkOnboardingStatus = useCallback(() => {
    try {
      // Check if onboarding is complete
      const isComplete = localStorage.getItem('onboardingComplete') === 'true';
      setOnboardingComplete(isComplete);
      
      // Check if there's a name set during onboarding
      const name = localStorage.getItem('user_display_name');
      if (name) {
        setDisplayName(name);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setOnboardingComplete(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  const completeOnboarding = useCallback(() => {
    try {
      localStorage.setItem('onboardingComplete', 'true');
      setOnboardingComplete(true);
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  }, []);

  const resetOnboarding = useCallback(() => {
    try {
      localStorage.removeItem('onboardingComplete');
      setOnboardingComplete(false);
    } catch (error) {
      console.error('Error resetting onboarding:', error);
    }
  }, []);

  const saveNameToProfile = useCallback(async (userId: string, name: string) => {
    if (!userId || !name) return;
    
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
        console.error('Error saving display name to profile:', error);
      } else {
        // Clear from localStorage after successful save
        localStorage.removeItem('user_display_name');
      }
    } catch (error) {
      console.error('Error in saving display name:', error);
    }
  }, []);

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
