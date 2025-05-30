
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

  // Fetch subscription status from user profile
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
      return;
    }

    try {
      console.log('[SubscriptionProvider] Starting subscription info fetch for user:', user.id);
      setIsLoading(true);
      setError(null);

      // Test database connectivity first
      console.log('[SubscriptionProvider] Testing database connectivity...');
      const { data: testData, error: testError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (testError) {
        console.error('[SubscriptionProvider] Database connectivity test failed:', testError);
        throw new Error(`Database connection failed: ${testError.message}`);
      }

      console.log('[SubscriptionProvider] Database connectivity test result:', testData);

      // First ensure the profile exists
      console.log('[SubscriptionProvider] Ensuring profile exists...');
      const profileExists = await ensureProfileExists(user);
      if (!profileExists) {
        console.warn('[SubscriptionProvider] Failed to ensure profile exists for user:', user.id);
        throw new Error('Profile setup failed');
      }

      // Get subscription info
      console.log('[SubscriptionProvider] Getting subscription info...');
      const info = await getSubscriptionInfo(user);
      console.log('[SubscriptionProvider] Subscription info received:', info);
      setSubscriptionInfo(info);
    } catch (error) {
      console.error('[SubscriptionProvider] Error in fetchSubscriptionInfo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load subscription information';
      setError(errorMessage);
      
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
    }
  }, [user]);

  useEffect(() => {
    console.log('[SubscriptionProvider] Effect triggered for fetchSubscriptionInfo');
    fetchSubscriptionInfo();
  }, [fetchSubscriptionInfo]);

  // Set up real-time subscription updates
  useEffect(() => {
    if (!user?.id) {
      console.log('[SubscriptionProvider] No user for realtime setup');
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
  }, [user?.id]);

  const refreshSubscriptionStatus = async () => {
    console.log('[SubscriptionProvider] refreshSubscriptionStatus called');
    try {
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
  const finalIsLoading = revenueCatLoading || isLoading;

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
    refreshSubscriptionStatus
  };

  console.log('[SubscriptionProvider] Providing context value:', {
    isPremium,
    isTrialActive,
    subscriptionStatus: subscriptionInfo.subscriptionStatus,
    isLoading: finalIsLoading,
    error
  });

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
