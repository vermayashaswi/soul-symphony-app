
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useOnboarding() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const checkOnboardingStatus = () => {
    // Simplified check - just use localStorage for now
    const isComplete = localStorage.getItem('onboardingComplete') === 'true';
    setOnboardingComplete(isComplete);
    
    const name = localStorage.getItem('user_display_name');
    if (name) {
      setDisplayName(name);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('onboardingComplete', 'true');
    setOnboardingComplete(true);
  };

  const resetOnboarding = () => {
    localStorage.removeItem('onboardingComplete');
    setOnboardingComplete(false);
  };

  const saveNameToProfile = async (userId: string, name: string) => {
    if (!userId || !name) return;
    
    try {
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
