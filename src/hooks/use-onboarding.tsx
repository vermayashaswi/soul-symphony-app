
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingState } from '@/hooks/use-onboarding-state';

export function useOnboarding() {
  const { user } = useAuth();
  const onboardingState = useOnboardingState(user);

  return {
    ...onboardingState,
    user,
    checkOnboardingStatus: () => {
      // This will be handled automatically by the useOnboardingState hook
      console.log('[useOnboarding] checkOnboardingStatus called - handled by useOnboardingState');
    },
    resetOnboarding: async () => {
      try {
        localStorage.removeItem('onboardingComplete');
        
        if (user) {
          console.log('[useOnboarding] Resetting database onboarding status for user:', user.id);
          const { supabase } = await import('@/integrations/supabase/client');
          const { error } = await supabase
            .from('profiles')
            .update({ 
              onboarding_completed: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);
          
          if (error) {
            console.error('[useOnboarding] Error resetting onboarding status:', error);
          }
        }
        
        // Force a reload to reset state
        window.location.reload();
      } catch (error) {
        console.error('[useOnboarding] Error in resetOnboarding:', error);
      }
    }
  };
}
