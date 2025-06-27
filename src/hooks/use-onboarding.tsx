
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useOnboarding() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const checkOnboardingStatus = () => {
    // Check if onboarding is complete
    const isComplete = localStorage.getItem('onboardingComplete') === 'true';
    setOnboardingComplete(isComplete);
    
    // Check if there's a name set during onboarding
    const name = localStorage.getItem('user_display_name');
    if (name) {
      setDisplayName(name);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    // Add delay for native apps to ensure proper initialization
    const initDelay = typeof window !== 'undefined' && (window as any).Capacitor ? 1000 : 0;
    
    setTimeout(() => {
      checkOnboardingStatus();
    }, initDelay);
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('onboardingComplete', 'true');
    setOnboardingComplete(true);
  };

  const resetOnboarding = () => {
    localStorage.removeItem('onboardingComplete');
    localStorage.removeItem('user_display_name');
    setOnboardingComplete(false);
    setDisplayName(null);
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
        console.log('[Onboarding] Display name saved to profile successfully');
        // Clear from localStorage after successful save
        localStorage.removeItem('user_display_name');
      }
    } catch (error) {
      console.error('Error in saving display name:', error);
    }
  };

  return {
    onboardingComplete,
    loading,
    displayName,
    completeOnboarding,
    resetOnboarding,
    saveNameToProfile,
    checkOnboardingStatus
  };
}
