
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useOnboarding() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const checkOnboardingStatus = async () => {
    try {
      setLoading(true);
      
      // Check if onboarding is complete from localStorage first for quick response
      const localOnboardingComplete = localStorage.getItem('onboardingComplete') === 'true';
      
      // Also check if there's a name set during onboarding
      const name = localStorage.getItem('user_display_name');
      if (name) {
        setDisplayName(name);
      }
      
      // Set the state immediately from localStorage
      setOnboardingComplete(localOnboardingComplete);
      
      console.log('[useOnboarding] Onboarding status check:', {
        localOnboardingComplete,
        displayName: name
      });
      
    } catch (error) {
      console.error('[useOnboarding] Error checking onboarding status:', error);
      // Default to incomplete if there's an error
      setOnboardingComplete(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('onboardingComplete', 'true');
    setOnboardingComplete(true);
    console.log('[useOnboarding] Onboarding marked as complete');
  };

  const resetOnboarding = () => {
    localStorage.removeItem('onboardingComplete');
    setOnboardingComplete(false);
    console.log('[useOnboarding] Onboarding reset');
  };

  const saveNameToProfile = async (userId: string, name: string) => {
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
        console.log('[useOnboarding] Display name saved to profile');
      }
    } catch (error) {
      console.error('Error in saving display name:', error);
    }
  };

  return {
    onboardingComplete: onboardingComplete ?? false, // Default to false if null
    loading,
    displayName,
    completeOnboarding,
    resetOnboarding,
    saveNameToProfile,
    checkOnboardingStatus
  };
}
