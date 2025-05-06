
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/contexts/TranslationContext';

export function useOnboarding() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const { currentLanguage } = useTranslation();

  useEffect(() => {
    // Check if onboarding is complete
    const isComplete = localStorage.getItem('onboardingComplete') === 'true';
    setOnboardingComplete(isComplete);
    
    // Check if there's a name set during onboarding
    const name = localStorage.getItem('user_display_name');
    if (name) {
      setDisplayName(name);
    }
    
    // Also clear the tutorial flag to ensure tutorial shows for all users
    localStorage.removeItem('soulo_visited_app_before');
    
    setLoading(false);
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('onboardingComplete', 'true');
    setOnboardingComplete(true);
  };

  const resetOnboarding = () => {
    localStorage.removeItem('onboardingComplete');
    setOnboardingComplete(false);
    
    // Also reset tutorial state
    localStorage.removeItem('soulo_tutorial_completed');
    localStorage.removeItem('soulo_tutorial_current_step');
    localStorage.removeItem('soulo_visited_app_before');
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
    saveNameToProfile
  };
}
