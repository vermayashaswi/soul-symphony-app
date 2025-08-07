import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { subscriptionErrorHandler } from '@/services/subscriptionErrorHandler';
import { logger } from '@/utils/logger';

export type SubscriptionTier = 'free' | 'premium';
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'trial' | 'free' | 'unknown';

export interface NonBlockingSubscriptionContextType {
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
  
  // Background loading state
  isBackgroundLoading: boolean;
}

const NonBlockingSubscriptionContext = createContext<NonBlockingSubscriptionContextType | undefined>(undefined);

/**
 * Non-blocking subscription provider that loads data in the background
 * This prevents subscription queries from blocking app initialization
 */
export const NonBlockingSubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [status, setStatus] = useState<SubscriptionStatus>('free'); // Default to 'free' instead of 'unknown'
  const [isLoading, setIsLoading] = useState(false); // Start as false, load in background
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialLoadCompleted, setHasInitialLoadCompleted] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState<Date | null>(null);
  const [isTrialEligible, setIsTrialEligible] = useState(false);
  
  const subscriptionLogger = logger.createLogger('NonBlockingSubscription');

  const fetchSubscriptionDataBackground = async (): Promise<void> => {
    if (!user) {
      // Immediately set to free state for logged out users
      setTier('free');
      setStatus('free');
      setIsLoading(false);
      setIsBackgroundLoading(false);
      setError(null);
      setHasInitialLoadCompleted(true);
      setTrialEndDate(null);
      setIsTrialEligible(false);
      return;
    }

    try {
      setIsBackgroundLoading(true);
      setError(null);
      
      subscriptionLogger.info('Starting background subscription data fetch', { userId: user.id });
      
      // Skip cleanup function in background mode to prevent blocking
      // The cleanup can happen separately via cron or other background processes
      
      // Use the subscription status function with a timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Subscription query timeout')), 5000); // 5 second timeout
      });

      const queryPromise = supabase
        .rpc('get_user_subscription_status', {
          user_id_param: user.id
        });

      const { data: statusData, error: statusError } = await Promise.race([
        queryPromise,
        timeoutPromise
      ]).catch((error) => {
        subscriptionLogger.warn('Subscription query timed out or failed, using fallback', error);
        return { data: null, error };
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
        
        subscriptionLogger.info('Updated subscription from background function:', {
          tier: userTier,
          status: userStatus,
          trialEndDate: userTrialEndDate,
          isTrialActive: userIsTrialActive,
          isPremium: subscriptionData.is_premium_access
        });
      } else {
        // Quick fallback - don't block for profile query
        subscriptionLogger.info('No subscription data found, defaulting to free tier');
        setTier('free');
        setStatus('free');
        setTrialEndDate(null);
      }

      // Check trial eligibility in background (non-blocking)
      if (user.id) {
        const checkTrialEligibility = async () => {
          try {
            const { data: eligibilityData, error: eligibilityError } = await supabase
              .rpc('is_trial_eligible', {
                user_id_param: user.id
              });
            
            if (!eligibilityError && eligibilityData !== null) {
              setIsTrialEligible(eligibilityData);
            }
          } catch (error) {
            subscriptionLogger.warn('Trial eligibility check failed (non-critical)', error);
          }
        };
        
        checkTrialEligibility();
      }
      
    } catch (err) {
      subscriptionLogger.warn('Background subscription fetch failed, using fallback', err);
      
      // Use the error handler but don't show errors for background loading
      const handledError = subscriptionErrorHandler.handleError(err, 'BackgroundSubscription');
      
      // Only set error state for critical errors, and make them silent for background loading
      if (!handledError.silent) {
        setError('Unable to load subscription status');
      }
      
      // Ensure we always have a valid state
      setTier('free');
      setStatus('free');
      setTrialEndDate(null);
      setIsTrialEligible(false);
    } finally {
      setIsLoading(false);
      setIsBackgroundLoading(false);
      setHasInitialLoadCompleted(true);
    }
  };

  const refreshSubscription = async (): Promise<void> => {
    setIsLoading(true);
    await fetchSubscriptionDataBackground();
  };

  const refreshSubscriptionStatus = async (): Promise<void> => {
    await refreshSubscription();
  };

  // Load subscription data in background when user changes
  useEffect(() => {
    // Small delay to ensure this doesn't interfere with app initialization
    const backgroundTimeout = setTimeout(() => {
      fetchSubscriptionDataBackground();
    }, 2000); // 2 second delay for background loading

    // Reset error handler when user changes
    if (user) {
      subscriptionErrorHandler.reset();
    }

    return () => clearTimeout(backgroundTimeout);
  }, [user]);

  // Computed properties with proper trial logic
  const isPremium = tier === 'premium';
  
  // Check if trial is actually active (not expired) - more robust check
  const isTrialActive = status === 'trial' && trialEndDate && trialEndDate > new Date();
  
  // Has active subscription means either active subscription OR active (non-expired) trial
  const hasActiveSubscription = status === 'active' || isTrialActive;
  
  const daysRemainingInTrial = trialEndDate && isTrialActive
    ? Math.max(0, Math.ceil((trialEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const contextValue: NonBlockingSubscriptionContextType = {
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
    isTrialEligible,
    isBackgroundLoading
  };

  return (
    <NonBlockingSubscriptionContext.Provider value={contextValue}>
      {children}
    </NonBlockingSubscriptionContext.Provider>
  );
};

export const useNonBlockingSubscription = (): NonBlockingSubscriptionContextType => {
  const context = useContext(NonBlockingSubscriptionContext);
  if (context === undefined) {
    throw new Error('useNonBlockingSubscription must be used within a NonBlockingSubscriptionProvider');
  }
  return context;
};