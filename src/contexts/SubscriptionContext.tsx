
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logInfo, logError } from '@/components/debug/DebugPanel';

interface SubscriptionData {
  id: string;
  user_id: string;
  subscription_type: string;
  subscription_status: string;
  is_subscribed: boolean | null;
  trial_end_date: string | null;
  current_period_end: string | null;
  expires_date: string | null;
  revenuecat_customer_id: string | null;
  product_identifier: string | null;
  auto_renew_status: boolean | null;
}

interface SubscriptionContextType {
  subscription: SubscriptionData | null;
  isLoading: boolean;
  isPremium: boolean;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  refreshSubscription: () => Promise<void>;
  hasFeatureAccess: (feature: string) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = async () => {
    if (!user) {
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    try {
      logInfo('Fetching subscription data', 'SubscriptionContext', { userId: user.id });
      
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        logError('Error fetching subscription', 'SubscriptionContext', error);
        // Create default subscription if none exists
        await createDefaultSubscription();
        return;
      }

      if (!data) {
        // Create default subscription for new users
        await createDefaultSubscription();
        return;
      }

      setSubscription(data);
      logInfo('Subscription data loaded', 'SubscriptionContext', data);
    } catch (error) {
      logError('Error in fetchSubscription', 'SubscriptionContext', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createDefaultSubscription = async () => {
    if (!user) return;

    try {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 7); // 7-day trial

      const defaultSubscription = {
        user_id: user.id,
        subscription_type: 'free',
        subscription_status: 'trialing',
        is_subscribed: false,
        trial_end_date: trialEndDate.toISOString(),
        trial_start_date: new Date().toISOString(),
        auto_renew_status: true,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('user_subscriptions')
        .insert([defaultSubscription])
        .select()
        .single();

      if (error) {
        logError('Error creating default subscription', 'SubscriptionContext', error);
        return;
      }

      setSubscription(data);
      logInfo('Default subscription created', 'SubscriptionContext', data);
    } catch (error) {
      logError('Error in createDefaultSubscription', 'SubscriptionContext', error);
    }
  };

  const refreshSubscription = async () => {
    setIsLoading(true);
    await fetchSubscription();
  };

  // Calculate if premium access is active
  const isPremium = React.useMemo(() => {
    if (!subscription) return false;
    
    const isSubscribed = subscription.subscription_status === 'active';
    const isTrialing = subscription.subscription_status === 'trialing';
    
    if (isTrialing && subscription.trial_end_date) {
      const trialEnd = new Date(subscription.trial_end_date);
      const now = new Date();
      return now < trialEnd;
    }
    
    return isSubscribed;
  }, [subscription]);

  // Calculate if trial is active
  const isTrialActive = React.useMemo(() => {
    if (!subscription || subscription.subscription_status !== 'trialing') return false;
    
    if (subscription.trial_end_date) {
      const trialEnd = new Date(subscription.trial_end_date);
      const now = new Date();
      return now < trialEnd;
    }
    
    return false;
  }, [subscription]);

  // Calculate trial days remaining
  const trialDaysRemaining = React.useMemo(() => {
    if (!isTrialActive || !subscription?.trial_end_date) return 0;
    
    const trialEnd = new Date(subscription.trial_end_date);
    const now = new Date();
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }, [isTrialActive, subscription]);

  // Feature access control
  const hasFeatureAccess = (feature: string): boolean => {
    // Free features - always accessible
    const freeFeatures = ['journal', 'voice-recording', 'basic-insights'];
    
    if (freeFeatures.includes(feature)) {
      return true;
    }
    
    // Premium features - require subscription or trial
    const premiumFeatures = ['chat', 'advanced-insights', 'soulnet'];
    
    if (premiumFeatures.includes(feature)) {
      return isPremium;
    }
    
    return false;
  };

  useEffect(() => {
    fetchSubscription();
  }, [user]);

  const value: SubscriptionContextType = {
    subscription,
    isLoading,
    isPremium,
    isTrialActive,
    trialDaysRemaining,
    refreshSubscription,
    hasFeatureAccess
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
