
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { subscriptionErrorHandler } from '@/services/subscriptionErrorHandler';

export type SubscriptionTier = 'free' | 'premium' | 'premium_plus';
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'trial' | 'unknown';

export interface SubscriptionContextType {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  isLoading: boolean;
  error: string | null;
  refreshSubscription: () => Promise<void>;
  isPremium: boolean;
  isPremiumPlus: boolean;
  hasActiveSubscription: boolean;
  
  // Additional properties for trial and subscription management
  isTrialActive: boolean;
  trialEndDate: Date | null;
  daysRemainingInTrial: number;
  subscriptionStatus: SubscriptionStatus;
  refreshSubscriptionStatus: () => Promise<void>;
  hasInitialLoadCompleted: boolean;
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

  const fetchSubscriptionData = async (): Promise<void> => {
    if (!user) {
      setTier('free');
      setStatus('unknown');
      setIsLoading(false);
      setError(null);
      setHasInitialLoadCompleted(true);
      setTrialEndDate(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('[SubscriptionContext] Fetching subscription data for user:', user.id);
      
      const { data, error: supabaseError } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_status, trial_ends_at')
        .eq('id', user.id)
        .maybeSingle();

      if (supabaseError) {
        throw supabaseError;
      }

      if (data) {
        const userTier = (data.subscription_tier as SubscriptionTier) || 'free';
        const userStatus = (data.subscription_status as SubscriptionStatus) || 'unknown';
        const userTrialEndDate = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
        
        setTier(userTier);
        setStatus(userStatus);
        setTrialEndDate(userTrialEndDate);
        
        console.log('[SubscriptionContext] Updated subscription:', {
          tier: userTier,
          status: userStatus,
          trialEndDate: userTrialEndDate
        });
      } else {
        // User profile doesn't exist yet, default to free
        setTier('free');
        setStatus('unknown');
        setTrialEndDate(null);
        console.log('[SubscriptionContext] No profile found, defaulting to free tier');
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
      setStatus('unknown');
      setTrialEndDate(null);
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

  // Fetch subscription data when user changes
  useEffect(() => {
    fetchSubscriptionData();
    
    // Reset error handler when user changes
    if (user) {
      subscriptionErrorHandler.reset();
    }
  }, [user]);

  // Computed properties
  const isPremium = tier === 'premium' || tier === 'premium_plus';
  const isPremiumPlus = tier === 'premium_plus';
  const hasActiveSubscription = status === 'active' || status === 'trial';
  
  // Trial-related computed properties
  const isTrialActive = status === 'trial' && trialEndDate && trialEndDate > new Date();
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
    isPremiumPlus,
    hasActiveSubscription,
    
    // Additional properties
    isTrialActive,
    trialEndDate,
    daysRemainingInTrial,
    subscriptionStatus: status, // Alias for status
    refreshSubscriptionStatus,
    hasInitialLoadCompleted
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
