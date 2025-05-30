
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { getSubscriptionInfo, SubscriptionInfo } from '@/services/subscriptionService';
import { ensureProfileExists } from '@/services/profileService';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionContextValue {
  isPremium: boolean;
  isTrialActive: boolean;
  trialEndDate: Date | null;
  daysRemainingInTrial: number;
  subscriptionStatus: string | null;
  isLoading: boolean;
  error: string | null;
  refreshSubscriptionStatus: () => Promise<void>;
  hasInitialLoadCompleted: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: React.ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  console.log('[SubscriptionProvider] Rendering');
  
  const { user } = useAuth();
  const {
    isPremium: revenueCatIsPremium,
    isTrialActive: revenueCatIsTrialActive,
    trialEndDate: revenueCatTrialEndDate,
    daysRemainingInTrial: revenueCatDaysRemaining,
    isLoading: revenueCatLoading,
    refreshPurchaserInfo
  } = useRevenueCat();

  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo>({
    isPremium: false,
    isTrialActive: false,
    trialEndDate: null,
    subscriptionStatus: 'free'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialLoadCompleted, setHasInitialLoadCompleted] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Fetch subscription status from user profile with improved error handling
  const fetchSubscriptionInfo = useCallback(async () => {
    console.log('[SubscriptionProvider] fetchSubscriptionInfo called, user:', user?.id);
    
    if (!user?.id) {
      console.log('[SubscriptionProvider] No user, setting default info');
      setSubscriptionInfo({
        isPremium: false,
        isTrialActive: false,
        trialEndDate: null,
        subscriptionStatus: 'free'
      });
      setIsLoading(false);
      setError(null);
      setHasInitialLoadCompleted(true);
      return;
    }

    try {
      console.log('[SubscriptionProvider] Starting subscription info fetch for user:', user.id);
      setIsLoading(true);
      setError(null);

      // Test database connectivity with timeout
      console.log('[SubscriptionProvider] Testing database connectivity...');
      const connectivityPromise = supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database connection timeout')), 8000)
      );

      const { data: testData, error: testError } = await Promise.race([
        connectivityPromise,
        timeoutPromise
      ]) as any;

      if (testError) {
        console.error('[SubscriptionProvider] Database connectivity test failed:', testError);
        throw new Error(`Database connection failed: ${testError.message}`);
      }

      console.log('[SubscriptionProvider] Database connectivity test passed:', testData);

      // Ensure the profile exists with timeout
      console.log('[SubscriptionProvider] Ensuring profile exists...');
      const profilePromise = ensureProfileExists(user);
      const profileTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile creation timeout')), 10000)
      );

      const profileExists = await Promise.race([
        profilePromise,
        profileTimeoutPromise
      ]) as boolean;

      if (!profileExists) {
        console.warn('[SubscriptionProvider] Failed to ensure profile exists for user:', user.id);
        throw new Error('Profile setup failed');
      }

      // Get subscription info with timeout
      console.log('[SubscriptionProvider] Getting subscription info...');
      const subscriptionPromise = getSubscriptionInfo(user);
      const subscriptionTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Subscription info fetch timeout')), 8000)
      );

      const info = await Promise.race([
        subscriptionPromise,
        subscriptionTimeoutPromise
      ]) as SubscriptionInfo;

      console.log('[SubscriptionProvider] Subscription info received:', info);
      setSubscriptionInfo(info);
      setRetryCount(0); // Reset retry count on success
    } catch (error) {
      console.error('[SubscriptionProvider] Error in fetchSubscriptionInfo:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to load subscription information';
      
      // Only set error state if we've exceeded retry attempts
      if (retryCount >= maxRetries) {
        setError(`Unable to load subscription status after ${maxRetries} attempts. App functionality may be limited.`);
        console.warn('[SubscriptionProvider] Max retries exceeded, setting error state');
      } else {
        console.log('[SubscriptionProvider] Will retry subscription info fetch, attempt:', retryCount + 1);
        setRetryCount(prev => prev + 1);
        
        // Retry after a delay
        setTimeout(() => {
          fetchSubscriptionInfo();
        }, Math.min(1000 * Math.pow(2, retryCount), 5000)); // Exponential backoff, max 5s
        return; // Exit early to prevent setting loading to false
      }
      
      // Set default subscription info on error
      setSubscriptionInfo({
        isPremium: false,
        isTrialActive: false,
        trialEndDate: null,
        subscriptionStatus: 'free'
      });
    } finally {
      console.log('[SubscriptionProvider] fetchSubscriptionInfo completed');
      setIsLoading(false);
      setHasInitialLoadCompleted(true);
    }
  }, [user, retryCount]);

  useEffect(() => {
    console.log('[SubscriptionProvider] Effect triggered for fetchSubscriptionInfo');
    if (!hasInitialLoadCompleted || retryCount === 0) {
      fetchSubscriptionInfo();
    }
  }, [fetchSubscriptionInfo, hasInitialLoadCompleted, retryCount]);

  // Set up real-time subscription updates
  useEffect(() => {
    if (!user?.id || !hasInitialLoadCompleted) {
      console.log('[SubscriptionProvider] Skipping realtime setup - no user or initial load not completed');
      return;
    }

    console.log('[SubscriptionProvider] Setting up realtime subscription for user:', user.id);

    const channel = supabase
      .channel(`subscription-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          console.log('[SubscriptionProvider] Profile subscription status changed:', payload);
          if (payload.new && typeof payload.new === 'object' && payload.new !== null) {
            const newData = payload.new as Record<string, any>;
            if ('subscription_status' in newData) {
              console.log('[SubscriptionProvider] Updating subscription info from realtime');
              setSubscriptionInfo(prev => ({
                ...prev,
                subscriptionStatus: newData.subscription_status,
                isPremium: newData.is_premium || false,
                trialEndDate: newData.trial_ends_at ? new Date(newData.trial_ends_at) : null,
                isTrialActive: newData.trial_ends_at ? new Date(newData.trial_ends_at) > new Date() : false
              }));
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[SubscriptionProvider] Subscription channel status:', status);
      });

    return () => {
      console.log('[SubscriptionProvider] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, hasInitialLoadCompleted]);

  const refreshSubscriptionStatus = async () => {
    console.log('[SubscriptionProvider] refreshSubscriptionStatus called');
    try {
      setRetryCount(0); // Reset retry count when manually refreshing
      await Promise.all([
        fetchSubscriptionInfo(),
        refreshPurchaserInfo()
      ]);
    } catch (error) {
      console.error('[SubscriptionProvider] Error refreshing subscription status:', error);
      throw error;
    }
  };

  // Combine RevenueCat data with profile data for final status
  const isPremium = revenueCatIsPremium || subscriptionInfo.isPremium;
  const isTrialActive = revenueCatIsTrialActive || subscriptionInfo.isTrialActive;
  const trialEndDate = revenueCatTrialEndDate || subscriptionInfo.trialEndDate;
  const finalIsLoading = (revenueCatLoading || isLoading) && !hasInitialLoadCompleted;

  const daysRemainingInTrial = trialEndDate 
    ? Math.max(0, Math.ceil((trialEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : revenueCatDaysRemaining;

  const value: SubscriptionContextValue = {
    isPremium,
    isTrialActive,
    trialEndDate,
    daysRemainingInTrial,
    subscriptionStatus: subscriptionInfo.subscriptionStatus,
    isLoading: finalIsLoading,
    error,
    refreshSubscriptionStatus,
    hasInitialLoadCompleted
  };

  console.log('[SubscriptionProvider] Providing context value:', {
    isPremium,
    isTrialActive,
    subscriptionStatus: subscriptionInfo.subscriptionStatus,
    isLoading: finalIsLoading,
    error,
    hasInitialLoadCompleted
  });

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
