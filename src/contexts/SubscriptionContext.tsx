import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { subscriptionErrorHandler } from '@/services/subscriptionErrorHandler';

export type SubscriptionTier = 'free' | 'premium';
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'trial' | 'free' | 'unknown';

export interface SubscriptionContextType {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  isLoading: boolean;
  error: string | null;
  refreshSubscription: () => Promise<void>;
  isPremium: boolean;
  hasActiveSubscription: boolean;

  isTrialActive: boolean;
  trialEndDate: Date | null;
  daysRemainingInTrial: number;
  subscriptionStatus: SubscriptionStatus;
  refreshSubscriptionStatus: () => Promise<void>;
  hasInitialLoadCompleted: boolean;
  isTrialEligible: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [status, setStatus] = useState<SubscriptionStatus>('unknown');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialLoadCompleted, setHasInitialLoadCompleted] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState<Date | null>(null);
  const [isTrialEligible, setIsTrialEligible] = useState(false);
  const [isPremiumFlag, setIsPremiumFlag] = useState<boolean>(false);

  // ---- Utils for robust mapping
  // Maps backend/fallback tier/status/flags to premium/free
  const isDbTierPremium = (t: unknown) => (t === 'premium' || t === true);
  const isDbStatusTrial = (s: unknown) => (s === 'trial' || s === 'in_trial');
  const isDbStatusActive = (s: unknown) => (s === 'active' || s === true);
  const isDbStatusKnownPremium = (s: unknown) => (isDbStatusActive(s) || isDbStatusTrial(s));

  const fetchSubscriptionData = async (): Promise<void> => {
    if (!user) {
      setTier('free');
      setStatus('unknown');
      setIsLoading(false);
      setError(null);
      setHasInitialLoadCompleted(true);
      setTrialEndDate(null);
      setIsTrialEligible(false);
      setIsPremiumFlag(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // --- [1] Cleanup expired trials before anything else.
      const { error: cleanupError } = await supabase.rpc('cleanup_expired_trials');
      if (cleanupError) {
        console.warn('[SubscriptionContext] Cleanup function error:', cleanupError);
      }
      
      // --- [2] Use the main function to get status.
      const { data: statusData, error: statusError } = await supabase
        .rpc('get_user_subscription_status', { user_id_param: user.id });

      let userTier: SubscriptionTier = 'free';
      let userStatus: SubscriptionStatus = 'free';
      let userTrialEndDate: Date | null = null;
      let userPremiumFlag = false;
      let userIsTrialActive = false;

      if (statusError) {
        console.log('[SubscriptionContext] get_user_subscription_status error, falling back:', statusError);
      }

      if (statusData && statusData.length > 0) {
        const sub = statusData[0];

        userTier = isDbTierPremium(sub.current_tier) ? 'premium' : 'free';
        userStatus = (sub.current_status as SubscriptionStatus) || 'free';
        userTrialEndDate = sub.trial_end_date ? new Date(sub.trial_end_date) : null;
        userPremiumFlag = !!sub.is_premium_access || isDbTierPremium(sub.current_tier) || isDbStatusKnownPremium(sub.current_status);
        userIsTrialActive = !!sub.is_trial_active || isDbStatusTrial(sub.current_status);

        console.log('[SubscriptionContext] get_user_subscription_status success:', {
          userTier, userStatus, userTrialEndDate, userPremiumFlag, userIsTrialActive,
          backend: sub,
        });
      } else {
        // --- [3] Fallback to the profile if no function result.
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('subscription_tier, subscription_status, trial_ends_at, is_premium')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (profileData) {
          userTier = isDbTierPremium(profileData.subscription_tier) ? 'premium' : 'free';
          userStatus = (profileData.subscription_status as SubscriptionStatus) || 'free';
          userTrialEndDate = profileData.trial_ends_at ? new Date(profileData.trial_ends_at) : null;
          userPremiumFlag = !!profileData.is_premium || isDbTierPremium(profileData.subscription_tier) || isDbStatusKnownPremium(profileData.subscription_status);

          if (userTrialEndDate && userTrialEndDate > new Date()) {
            userIsTrialActive = true;
          } else if (isDbStatusTrial(userStatus)) {
            userIsTrialActive = true;
          }
          console.log('[SubscriptionContext] Used profile fallback:', {
            userTier, userStatus, userTrialEndDate, userPremiumFlag, userIsTrialActive, backend: profileData,
          });
        }
      }

      setTier(userTier);
      setStatus(userStatus);
      setTrialEndDate(userTrialEndDate);
      setIsPremiumFlag(userPremiumFlag);

      // --- [4] Always check trial eligibility
      let trialEligibleFlag = false;
      if (user.id) {
        const { data: eligibilityData, error: eligibilityError } = await supabase
          .rpc('is_trial_eligible', { user_id_param: user.id });
        if (!eligibilityError && eligibilityData !== null) {
          trialEligibleFlag = eligibilityData as boolean;
        }
      }
      setIsTrialEligible(trialEligibleFlag);

    } catch (err) {
      console.error('[SubscriptionContext] Error fetching subscription:', err);

      const handledError = subscriptionErrorHandler.handleError(err, 'Subscription');
      if (!handledError.silent && handledError.type !== 'network') {
        setError(handledError.message);
      }
      setTier('free');
      setStatus('free');
      setTrialEndDate(null);
      setIsTrialEligible(false);
      setIsPremiumFlag(false);
    } finally {
      setIsLoading(false);
      setHasInitialLoadCompleted(true);
    }
  };

  const refreshSubscription = async (): Promise<void> => {
    await fetchSubscriptionData();
  };

  const refreshSubscriptionStatus = async (): Promise<void> => {
    await fetchSubscriptionData();
  };

  useEffect(() => {
    fetchSubscriptionData();
    if (user) {
      subscriptionErrorHandler.reset();
    }
  }, [user]);

  // --- Robust trial and premium logic ---
  const isPremium = tier === 'premium' || isPremiumFlag;

  // Check if trial is actually active (not expired)
  const isTrialActive = (status === 'trial' || status === 'in_trial') && trialEndDate && trialEndDate > new Date();

  // Has active subscription means premium, active, or trial states, or premium flag
  const hasActiveSubscription = (
    isPremium ||
    status === 'active' ||
    isTrialActive
  );

  const daysRemainingInTrial = trialEndDate && isTrialActive
    ? Math.max(0, Math.ceil((trialEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const contextValue: SubscriptionContextType = {
    tier,
    status,
    isLoading,
    error,
    refreshSubscription,
    isPremium,
    hasActiveSubscription,

    isTrialActive,
    trialEndDate,
    daysRemainingInTrial,
    subscriptionStatus: status,
    refreshSubscriptionStatus,
    hasInitialLoadCompleted,
    isTrialEligible,
  };

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
