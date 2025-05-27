
import { useState, useEffect, useCallback } from 'react';
import { CustomerInfo } from '@revenuecat/purchases-js';
import { subscriptionService, SubscriptionStatus } from '@/services/subscriptionService';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface UseSubscriptionReturn {
  subscriptionStatus: SubscriptionStatus;
  customerInfo: CustomerInfo | null;
  isLoading: boolean;
  error: string | null;
  refreshSubscription: () => Promise<void>;
  hasActiveSubscription: boolean;
  hasActiveTrialOrSubscription: boolean;
  daysUntilTrialExpires: number | null;
}

export function useSubscription(): UseSubscriptionReturn {
  const { user } = useAuth();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSubscription = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      
      // Initialize RevenueCat if needed
      await subscriptionService.initialize(user.id);
      
      // Get customer info
      const info = await subscriptionService.getCustomerInfo();
      setCustomerInfo(info);
      
    } catch (err) {
      console.error('Failed to refresh subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to load subscription');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  // Listen for real-time updates to subscription status
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('subscription-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscription_transactions',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          // Refresh when subscription data changes
          refreshSubscription();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refreshSubscription]);

  const subscriptionStatus = subscriptionService.getSubscriptionStatus(customerInfo);

  const daysUntilTrialExpires = subscriptionStatus.trialEndsAt
    ? Math.ceil((subscriptionStatus.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    subscriptionStatus,
    customerInfo,
    isLoading,
    error,
    refreshSubscription,
    hasActiveSubscription: subscriptionStatus.isActive && !subscriptionStatus.isTrialActive,
    hasActiveTrialOrSubscription: subscriptionStatus.isActive,
    daysUntilTrialExpires
  };
}
