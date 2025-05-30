
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
    if (!user?.id) {
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
      setIsLoading(true);
      setError(null);

      // First ensure the profile exists
      const profileExists = await ensureProfileExists(user);
      if (!profileExists) {
        console.warn('Failed to ensure profile exists for user:', user.id);
        setError('Profile setup failed');
      }

      // Get subscription info
      const info = await getSubscriptionInfo(user);
      setSubscriptionInfo(info);
    } catch (error) {
      console.error('Error in fetchSubscriptionInfo:', error);
      setError('Failed to load subscription information');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscriptionInfo();
  }, [fetchSubscriptionInfo]);

  // Set up real-time subscription updates
  useEffect(() => {
    if (!user?.id) return;

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
          console.log('Profile subscription status changed:', payload);
          if (payload.new && 'subscription_status' in payload.new) {
            setSubscriptionInfo(prev => ({
              ...prev,
              subscriptionStatus: payload.new.subscription_status,
              isPremium: payload.new.is_premium || false,
              trialEndDate: payload.new.trial_ends_at ? new Date(payload.new.trial_ends_at) : null,
              isTrialActive: payload.new.trial_ends_at ? new Date(payload.new.trial_ends_at) > new Date() : false
            }));
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const refreshSubscriptionStatus = async () => {
    await Promise.all([
      fetchSubscriptionInfo(),
      refreshPurchaserInfo()
    ]);
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

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
