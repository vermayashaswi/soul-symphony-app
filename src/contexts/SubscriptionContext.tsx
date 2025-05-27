
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionContextValue {
  isPremium: boolean;
  isTrialActive: boolean;
  trialEndDate: Date | null;
  daysRemainingInTrial: number;
  subscriptionStatus: string | null;
  isLoading: boolean;
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

  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Fetch subscription status from user profile
  const fetchProfileSubscriptionStatus = async () => {
    if (!user?.id) {
      setProfileLoading(false);
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_status, is_premium')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile subscription status:', error);
      } else {
        setSubscriptionStatus(profile?.subscription_status || 'free');
      }
    } catch (error) {
      console.error('Error in fetchProfileSubscriptionStatus:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileSubscriptionStatus();
  }, [user?.id]);

  // Set up real-time subscription updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('subscription-changes')
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
            setSubscriptionStatus(payload.new.subscription_status);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const refreshSubscriptionStatus = async () => {
    await Promise.all([
      fetchProfileSubscriptionStatus(),
      refreshPurchaserInfo()
    ]);
  };

  // Combine RevenueCat data with profile data for final status
  const isPremium = revenueCatIsPremium || ['active', 'trial'].includes(subscriptionStatus || '');
  const isTrialActive = revenueCatIsTrialActive || subscriptionStatus === 'trial';
  const isLoading = revenueCatLoading || profileLoading;

  const value: SubscriptionContextValue = {
    isPremium,
    isTrialActive,
    trialEndDate: revenueCatTrialEndDate,
    daysRemainingInTrial: revenueCatDaysRemaining,
    subscriptionStatus,
    isLoading,
    refreshSubscriptionStatus
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
