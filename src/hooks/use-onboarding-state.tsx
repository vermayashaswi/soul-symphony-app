
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface OnboardingState {
  onboardingComplete: boolean | null;
  loading: boolean;
  displayName: string | null;
  isReady: boolean;
}

export function useOnboardingState(user: User | null) {
  const [state, setState] = useState<OnboardingState>({
    onboardingComplete: null,
    loading: true,
    displayName: null,
    isReady: false
  });

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        console.log('[OnboardingState] Checking onboarding status...', { hasUser: !!user });
        
        // For native apps, add small delay for stability
        const isNative = nativeIntegrationService.isRunningNatively();
        if (isNative) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        setState(prev => ({ ...prev, loading: true }));
        
        if (user) {
          console.log('[OnboardingState] Checking for authenticated user:', user.id);
          
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('onboarding_completed, display_name')
            .eq('id', user.id)
            .single();
          
          if (error) {
            console.error('[OnboardingState] Error fetching profile:', error);
            // Fallback to localStorage
            const isComplete = localStorage.getItem('onboardingComplete') === 'true';
            const name = localStorage.getItem('user_display_name');
            setState({
              onboardingComplete: isComplete,
              loading: false,
              displayName: name,
              isReady: true
            });
          } else {
            console.log('[OnboardingState] Profile data:', profile);
            setState({
              onboardingComplete: profile.onboarding_completed || false,
              loading: false,
              displayName: profile.display_name,
              isReady: true
            });
          }
        } else {
          // For unauthenticated users, use localStorage
          console.log('[OnboardingState] Checking localStorage for unauthenticated user');
          const isComplete = localStorage.getItem('onboardingComplete') === 'true';
          const name = localStorage.getItem('user_display_name');
          setState({
            onboardingComplete: isComplete,
            loading: false,
            displayName: name,
            isReady: true
          });
        }
      } catch (error) {
        console.error('[OnboardingState] Error in checkOnboardingStatus:', error);
        // Fallback to localStorage
        const isComplete = localStorage.getItem('onboardingComplete') === 'true';
        const name = localStorage.getItem('user_display_name');
        setState({
          onboardingComplete: isComplete,
          loading: false,
          displayName: name,
          isReady: true
        });
      }
    };

    checkOnboardingStatus();
  }, [user]);

  const completeOnboarding = async () => {
    try {
      localStorage.setItem('onboardingComplete', 'true');
      setState(prev => ({ ...prev, onboardingComplete: true }));
      
      if (user) {
        console.log('[OnboardingState] Updating database onboarding status for user:', user.id);
        const { error } = await supabase
          .from('profiles')
          .update({ 
            onboarding_completed: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        
        if (error) {
          console.error('[OnboardingState] Error updating onboarding status:', error);
        }
      }
    } catch (error) {
      console.error('[OnboardingState] Error in completeOnboarding:', error);
    }
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
        console.error('[OnboardingState] Error saving display name:', error);
      } else {
        setState(prev => ({ ...prev, displayName: name }));
        localStorage.removeItem('user_display_name');
      }
    } catch (error) {
      console.error('[OnboardingState] Error in saving display name:', error);
    }
  };

  return {
    ...state,
    completeOnboarding,
    saveNameToProfile
  };
}
