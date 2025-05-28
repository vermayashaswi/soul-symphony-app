
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useAutoTrialActivation = () => {
  const { user } = useAuth();

  useEffect(() => {
    const activateTrialForNewUser = async () => {
      if (!user) return;

      try {
        // Check if user already has a profile with subscription data
        const { data: existingProfile, error: profileError } = await supabase
          .from('profiles')
          .select('subscription_status, trial_ends_at, is_premium')
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error checking existing profile:', profileError);
          return;
        }

        // If user doesn't have subscription data or has null values, activate trial
        if (!existingProfile || existingProfile.subscription_status === null) {
          const trialEndDate = new Date();
          trialEndDate.setDate(trialEndDate.getDate() + 7); // 7 days from now

          const { error: updateError } = await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              subscription_status: 'trial',
              trial_ends_at: trialEndDate.toISOString(),
              is_premium: true,
              updated_at: new Date().toISOString()
            });

          if (updateError) {
            console.error('Error activating trial:', updateError);
            toast.error('Failed to activate your free trial');
          } else {
            console.log('Trial activated for user:', user.id);
            toast.success('Welcome! Your 7-day free trial has been activated');
          }
        }
      } catch (error) {
        console.error('Error in auto trial activation:', error);
      }
    };

    // Only run once when user is first authenticated
    if (user) {
      activateTrialForNewUser();
    }
  }, [user?.id]); // Only depend on user.id to avoid re-running on every user object change
};
