import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { useAppInitialization } from '@/contexts/AppInitializationContext';

export function useOnboarding() {
  // This hook now uses the centralized app initialization context
  const { 
    onboardingComplete, 
    isOnboardingLoading, 
    user,
    completeOnboarding: completeOnboardingAction,
    resetOnboarding: resetOnboardingAction 
  } = useAppInitialization();

  const [displayName, setDisplayName] = useState<string>('');

  // Fetch display name when user changes
  useEffect(() => {
    if (user) {
      const fetchDisplayName = async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', user.id)
            .single();
          
          if (!error && data) {
            setDisplayName(data.display_name || '');
          }
        } catch (error) {
          console.warn('[Onboarding] Error fetching display name:', error);
        }
      };
      
      fetchDisplayName();
    } else {
      setDisplayName('');
    }
  }, [user]);

  const checkOnboardingStatus = async (): Promise<boolean> => {
    // This is now handled by the centralized context
    return onboardingComplete || false;
  };

  const completeOnboarding = async (): Promise<void> => {
    await completeOnboardingAction();
  };

  const resetOnboarding = async (): Promise<void> => {
    await resetOnboardingAction();
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
        // Update local state
        setDisplayName(name);
        // Clear from localStorage after successful save
        localStorage.removeItem('user_display_name');
      }
    } catch (error) {
      console.error('Error in saving display name:', error);
    }
  };

  return {
    onboardingComplete,
    loading: isOnboardingLoading,
    displayName,
    user,
    completeOnboarding,
    resetOnboarding,
    saveNameToProfile,
    checkOnboardingStatus
  };
}