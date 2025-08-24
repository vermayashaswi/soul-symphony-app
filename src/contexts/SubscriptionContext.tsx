
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { subscriptionErrorHandler } from '@/services/subscriptionErrorHandler';
import { iPhoneDebugLogger } from '@/services/iPhoneDebugLogger';

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
  
  // Additional properties for trial and subscription management
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

  const fetchSubscriptionData = async (): Promise<void> => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isIPhone = /iphone/i.test(userAgent.toLowerCase());
    
    if (!user) {
      setTier('free');
      setStatus('unknown');
      setIsLoading(false);
      setError(null);
      setHasInitialLoadCompleted(true);
      setTrialEndDate(null);
      setIsTrialEligible(false);
      
      if (isIPhone) {
        iPhoneDebugLogger.logSubscriptionCheck({ result: 'no-user', tier: 'free' });
      }
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('[SubscriptionContext] Fetching subscription data for user:', user.id);
      
      // iPhone-specific debug logging
      if (isIPhone) {
        iPhoneDebugLogger.logSubscriptionCheck({ 
          stage: 'start', 
          userId: user.id,
          hasUser: !!user 
        });
      }
      
      // First call the cleanup function to ensure expired trials are processed
      const { error: cleanupError } = await supabase.rpc('cleanup_expired_trials');
      if (cleanupError) {
        console.warn('[SubscriptionContext] Cleanup function error:', cleanupError);
      }
      
      // Use the comprehensive subscription status function with authenticated user context
      const { data: statusData, error: statusError } = await supabase
        .rpc('get_user_subscription_status', {
          user_id_param: user.id
        });

      if (statusError) {
        throw statusError;
      }

      if (statusData && statusData.length > 0) {
        const subscriptionData = statusData[0];
        
        // Map subscription tier - ensure only 'free' or 'premium'
        const userTier = (subscriptionData.current_tier === 'premium') ? 'premium' : 'free';
        const userStatus = (subscriptionData.current_status as SubscriptionStatus) || 'free';
        const userTrialEndDate = subscriptionData.trial_end_date ? new Date(subscriptionData.trial_end_date) : null;
        const userIsTrialActive = subscriptionData.is_trial_active || false;
        
        setTier(userTier);
        setStatus(userStatus);
        setTrialEndDate(userTrialEndDate);
        
        console.log('[SubscriptionContext] Updated subscription from function:', {
          tier: userTier,
          status: userStatus,
          trialEndDate: userTrialEndDate,
          isTrialActive: userIsTrialActive,
          isPremium: subscriptionData.is_premium_access,
          computedAccess: userTier === 'premium' && userStatus === 'trial'
        });

        // iPhone-specific debug logging
        if (isIPhone) {
          iPhoneDebugLogger.logSubscriptionCheck({
            stage: 'function-success',
            tier: userTier,
            status: userStatus,
            isTrialActive: userIsTrialActive,
            isPremium: subscriptionData.is_premium_access
          });
        }
      } else {
        // Fallback to direct profile query if function fails - RLS ensures user can only access their own profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('subscription_tier, subscription_status, trial_ends_at, is_premium')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (profileData) {
          // Map subscription tier - ensure only 'free' or 'premium'
          const userTier = (profileData.subscription_tier === 'premium') ? 'premium' : 'free';
          const userStatus = (profileData.subscription_status as SubscriptionStatus) || 'free';
          const userTrialEndDate = profileData.trial_ends_at ? new Date(profileData.trial_ends_at) : null;
          
          setTier(userTier);
          setStatus(userStatus);
          setTrialEndDate(userTrialEndDate);
          
          console.log('[SubscriptionContext] Updated subscription from fallback:', {
            tier: userTier,
            status: userStatus,
            trialEndDate: userTrialEndDate,
            isPremium: profileData.is_premium
          });
        } else {
          // User profile doesn't exist yet, default to free
          setTier('free');
          setStatus('free');
          setTrialEndDate(null);
          console.log('[SubscriptionContext] No profile found, defaulting to free tier');
        }
      }

      // Check trial eligibility - function validates user context internally
      if (user.id) {
        const { data: eligibilityData, error: eligibilityError } = await supabase
          .rpc('is_trial_eligible', {
            user_id_param: user.id
          });

        if (!eligibilityError && eligibilityData !== null) {
          setIsTrialEligible(eligibilityData);
        }
      }
      
    } catch (err) {
      console.error('[SubscriptionContext] Error fetching subscription:', err);
      
      // Use the error handler to categorize and potentially show the error
      const handledError = subscriptionErrorHandler.handleError(err, 'Subscription');
      
      // Only set error state for critical errors that aren't silenced
      if (!handledError.silent && handledError.type !== 'network') {
        setError(handledError.message);
      }
      
      // Default to free tier on error
      setTier('free');
      setStatus('free');
      setTrialEndDate(null);
      setIsTrialEligible(false);
    } finally {
      setIsLoading(false);
      setHasInitialLoadCompleted(true);
      
      // iPhone-specific completion logging
      if (isIPhone) {
        iPhoneDebugLogger.logSubscriptionCheck({
          stage: 'complete',
          finalTier: tier,
          finalStatus: status,
          finalHasActiveSubscription: status === 'active' || (status === 'trial' && tier === 'premium' && trialEndDate && trialEndDate > new Date())
        });
      }
    }
  };

  const refreshSubscription = async (): Promise<void> => {
    await fetchSubscriptionData();
  };

  const refreshSubscriptionStatus = async (): Promise<void> => {
    await fetchSubscriptionData();
  };

  // Fetch subscription data when user changes
  useEffect(() => {
    if (user) {
      // Add small delay to allow trial setup trigger to complete
      const timer = setTimeout(() => {
        fetchSubscriptionData();
      }, 500);
      
      // Reset error handler when user changes
      subscriptionErrorHandler.reset();
      
      return () => {
        clearTimeout(timer);
      };
    } else {
      fetchSubscriptionData();
    }
  }, [user]);

  // Computed properties with proper trial logic
  const isPremium = tier === 'premium';
  
  // Check if trial is actually active (not expired) - more robust check
  // CRITICAL: For premium tier users in trial status, they should have access
  const isTrialActive = (status === 'trial' && tier === 'premium' && trialEndDate && trialEndDate > new Date());
  
  // Has active subscription means either active subscription OR active (non-expired) trial
  // Also grant access if user has premium tier regardless of trial status (covers edge cases)
  const hasActiveSubscription = status === 'active' || isTrialActive || (tier === 'premium' && status === 'trial');
  
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
    
    // Additional properties
    isTrialActive,
    trialEndDate,
    daysRemainingInTrial,
    subscriptionStatus: status, // Alias for status
    refreshSubscriptionStatus,
    hasInitialLoadCompleted,
    isTrialEligible
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
