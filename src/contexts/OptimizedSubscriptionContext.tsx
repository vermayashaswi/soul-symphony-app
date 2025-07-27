import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuthContext } from './OptimizedAuthContext';
import { optimizedRouteService } from '@/services/optimizedRouteService';

export type SubscriptionTier = 'free' | 'premium';
export type SubscriptionStatus = 'free' | 'trial' | 'active' | 'cancelled';

interface OptimizedSubscriptionContextType {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  isLoading: boolean;
  isPremium: boolean;
  hasActiveSubscription: boolean;
  isTrialActive: boolean;
  refreshSubscription: () => Promise<void>;
}

const OptimizedSubscriptionContext = createContext<OptimizedSubscriptionContextType | undefined>(undefined);

export function OptimizedSubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useOptimizedAuthContext();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [status, setStatus] = useState<SubscriptionStatus>('free');
  const [isLoading, setIsLoading] = useState(true);
  const [isTrialActive, setIsTrialActive] = useState(false);

  const isNative = optimizedRouteService.isNativeApp();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setTier('free');
      setStatus('free');
      setIsTrialActive(false);
      setIsLoading(false);
      return;
    }

    // For native apps, check localStorage first
    if (isNative) {
      const cachedSubscription = localStorage.getItem(`subscription_${user.id}`);
      if (cachedSubscription) {
        try {
          const parsed = JSON.parse(cachedSubscription);
          setTier(parsed.tier || 'free');
          setStatus(parsed.status || 'free');
          setIsTrialActive(parsed.isTrialActive || false);
          setIsLoading(false);
          
          // Defer refresh to avoid blocking
          setTimeout(() => fetchSubscriptionData(), 200);
          return;
        } catch (e) {
          console.warn('[OptimizedSubscription] Invalid cached data');
        }
      }
    }

    fetchSubscriptionData();
  }, [user, isAuthenticated, isNative]);

  const fetchSubscriptionData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Use the optimized function that handles cleanup
      const { data, error } = await supabase.rpc('get_user_subscription_status', {
        user_id_param: user.id
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const subscription = data[0];
        const subscriptionData = {
          tier: subscription.current_tier as SubscriptionTier,
          status: subscription.current_status as SubscriptionStatus,
          isTrialActive: subscription.is_trial_active || false
        };

        setTier(subscriptionData.tier);
        setStatus(subscriptionData.status);
        setIsTrialActive(subscriptionData.isTrialActive);

        // Cache for native apps
        if (isNative) {
          localStorage.setItem(`subscription_${user.id}`, JSON.stringify(subscriptionData));
        }
      }
    } catch (error) {
      console.error('[OptimizedSubscription] Failed to fetch subscription data:', error);
      // Don't show errors to user, just use defaults
    } finally {
      setIsLoading(false);
    }
  };

  const contextValue: OptimizedSubscriptionContextType = {
    tier,
    status,
    isLoading,
    isPremium: tier === 'premium' || isTrialActive,
    hasActiveSubscription: status === 'active' || status === 'trial',
    isTrialActive,
    refreshSubscription: fetchSubscriptionData
  };

  return (
    <OptimizedSubscriptionContext.Provider value={contextValue}>
      {children}
    </OptimizedSubscriptionContext.Provider>
  );
}

export function useOptimizedSubscription() {
  const context = useContext(OptimizedSubscriptionContext);
  if (context === undefined) {
    throw new Error('useOptimizedSubscription must be used within an OptimizedSubscriptionProvider');
  }
  return context;
}