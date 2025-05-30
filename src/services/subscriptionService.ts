
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

export interface SubscriptionInfo {
  isPremium: boolean;
  isTrialActive: boolean;
  trialEndDate: Date | null;
  subscriptionStatus: string;
}

/**
 * Gets subscription information for a user
 */
export const getSubscriptionInfo = async (user: User | null): Promise<SubscriptionInfo> => {
  const defaultInfo: SubscriptionInfo = {
    isPremium: false,
    isTrialActive: false,
    trialEndDate: null,
    subscriptionStatus: 'free'
  };

  if (!user?.id) {
    console.log('No user provided to getSubscriptionInfo');
    return defaultInfo;
  }

  try {
    // First ensure the profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_status, is_premium, trial_ends_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile subscription info:', profileError);
      return defaultInfo;
    }

    if (!profile) {
      console.log('No profile found for user, returning default subscription info');
      return defaultInfo;
    }

    // Check if trial is still active
    const trialEndDate = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
    const isTrialActive = trialEndDate ? trialEndDate > new Date() : false;

    return {
      isPremium: profile.is_premium || false,
      isTrialActive,
      trialEndDate,
      subscriptionStatus: profile.subscription_status || 'free'
    };
  } catch (error) {
    console.error('Exception in getSubscriptionInfo:', error);
    return defaultInfo;
  }
};

/**
 * Updates subscription status for a user
 */
export const updateSubscriptionStatus = async (
  userId: string,
  status: string,
  isPremium: boolean = false
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_status: status,
        is_premium: isPremium,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating subscription status:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception updating subscription status:', error);
    return false;
  }
};
