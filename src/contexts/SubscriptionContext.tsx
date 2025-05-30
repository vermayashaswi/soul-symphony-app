
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { subscriptionErrorHandler } from '@/services/subscriptionErrorHandler';

export type SubscriptionTier = 'free' | 'premium' | 'premium_plus';
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'trial' | 'free' | 'unknown';

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
      
      // First call the cleanup function to ensure expired trials are processed
      const { error: cleanupError } = await supabase.rpc('cleanup_expired_trials');
      if (cleanupError) {
        console.warn('[SubscriptionContext] Cleanup function error:', cleanupError);
      }
      
      const { data, error: supabaseError } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_status, trial_ends_at, is_premium')
        .eq('id', user.id)
        .maybeSingle();

      if (supabaseError) {
        throw supabaseError;
      }

      if (data) {
        const userTier = (data.subscription_tier as SubscriptionTier) || 'free';
        const userStatus = (data.subscription_status as SubscriptionStatus) || 'free';
        const userTrialEndDate = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
        
        // Additional validation: if trial_ends_at is in the past, ensure status is not 'trial'
        const now = new Date();
        let finalStatus = userStatus;
        let finalTier = userTier;
        let finalIsPremium = data.is_premium || false;
        
        if (userStatus === 'trial' && userTrialEndDate && userTrialEndDate <= now) {
          console.log('[SubscriptionContext] Trial has expired, updating status to free');
          finalStatus = 'free';
          finalTier = 'free';
          finalIsPremium = false;
          
          // Update the database to reflect the expired trial
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              subscription_status: 'free',
              subscription_tier: 'free',
              is_premium: false
            })
            .eq('id', user.id);
            
          if (updateError) {
            console.error('[SubscriptionContext] Error updating expired trial:', updateError);
          }
        }
        
        setTier(finalTier);
        setStatus(finalStatus);
        setTrialEndDate(userTrialEndDate);
        
        console.log('[SubscriptionContext] Updated subscription:', {
          tier: finalTier,
          status: finalStatus,
          trialEndDate: userTrialEndDate,
          isPremium: finalIsPremium
        });
      } else {
        // User profile doesn't exist yet, default to free
        setTier('free');
        setStatus('free');
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
      setStatus('free');
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

  // Computed properties with proper trial expiry logic
  const isPremium = tier === 'premium' || tier === 'premium_plus';
  const isPremiumPlus = tier === 'premium_plus';
  
  // Check if trial is actually active (not expired)
  const isTrialActive = status === 'trial' && trialEndDate && trialEndDate > new Date();
  
  // Has active subscription means either active subscription OR active (non-expired) trial
  const hasActiveSubscription = status === 'active' || isTrialActive;
  
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
