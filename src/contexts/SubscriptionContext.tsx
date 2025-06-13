
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { subscriptionErrorHandler } from '@/services/subscriptionErrorHandler';
import { revenueCatService } from '@/services/revenuecat/revenueCatService';
import { REVENUECAT_CONFIG } from '@/config/revenueCatConfig';

export type SubscriptionTier = 'free' | 'premium';
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'trial' | 'free' | 'unknown';

export interface SubscriptionContextType {
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
  
  // RevenueCat integration
  revenueCatInitialized: boolean;
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
  const [isTrialEligible, setIsTrialEligible] = useState(false);
  const [revenueCatInitialized, setRevenueCatInitialized] = useState(false);

  // Initialize RevenueCat when user is available
  useEffect(() => {
    const initializeRevenueCat = async () => {
      if (!user?.id || revenueCatInitialized) return;
      
      try {
        console.log('[SubscriptionContext] Initializing RevenueCat for user:', user.id);
        await revenueCatService.initialize(user.id);
        setRevenueCatInitialized(true);
        console.log('[SubscriptionContext] RevenueCat initialized successfully');
      } catch (error) {
        console.error('[SubscriptionContext] RevenueCat initialization failed:', error);
        // Don't block the app if RevenueCat fails to initialize
        setRevenueCatInitialized(false);
      }
    };

    initializeRevenueCat();
  }, [user?.id, revenueCatInitialized]);

  const fetchSubscriptionData = async (): Promise<void> => {
    if (!user) {
      setTier('free');
      setStatus('unknown');
      setIsLoading(false);
      setError(null);
      setHasInitialLoadCompleted(true);
      setTrialEndDate(null);
      setIsTrialEligible(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('[SubscriptionContext] Fetching subscription data for user:', user.id);
      
      // First check RevenueCat if initialized
      if (revenueCatInitialized) {
        try {
          const purchaserInfo = await revenueCatService.getPurchaserInfo();
          
          if (purchaserInfo) {
            const isPremiumFromRC = revenueCatService.isUserPremium(purchaserInfo);
            const trialEndFromRC = revenueCatService.getTrialEndDate(purchaserInfo);
            
            console.log('[SubscriptionContext] RevenueCat data:', {
              isPremium: isPremiumFromRC,
              trialEnd: trialEndFromRC
            });
            
            // Update based on RevenueCat data
            if (isPremiumFromRC) {
              setTier('premium');
              setStatus(trialEndFromRC && trialEndFromRC > new Date() ? 'trial' : 'active');
              setTrialEndDate(trialEndFromRC);
            }
          }
        } catch (rcError) {
          console.warn('[SubscriptionContext] RevenueCat fetch failed, falling back to database:', rcError);
        }
      }
      
      // Always sync with our database as source of truth
      const { error: cleanupError } = await supabase.rpc('cleanup_expired_trials');
      if (cleanupError) {
        console.warn('[SubscriptionContext] Cleanup function error:', cleanupError);
      }
      
      const { data: statusData, error: statusError } = await supabase
        .rpc('get_user_subscription_status', {
          user_id_param: user.id
        });

      if (statusError) {
        throw statusError;
      }

      if (statusData && statusData.length > 0) {
        const subscriptionData = statusData[0];
        
        const userTier = (subscriptionData.current_tier === 'premium') ? 'premium' : 'free';
        const userStatus = (subscriptionData.current_status as SubscriptionStatus) || 'free';
        const userTrialEndDate = subscriptionData.trial_end_date ? new Date(subscriptionData.trial_end_date) : null;
        
        setTier(userTier);
        setStatus(userStatus);
        setTrialEndDate(userTrialEndDate);
        
        console.log('[SubscriptionContext] Database subscription status:', {
          tier: userTier,
          status: userStatus,
          trialEndDate: userTrialEndDate,
          isPremium: subscriptionData.is_premium_access
        });
      } else {
        // Fallback to profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('subscription_tier, subscription_status, trial_ends_at, is_premium')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (profileData) {
          const userTier = (profileData.subscription_tier === 'premium') ? 'premium' : 'free';
          const userStatus = (profileData.subscription_status as SubscriptionStatus) || 'free';
          const userTrialEndDate = profileData.trial_ends_at ? new Date(profileData.trial_ends_at) : null;
          
          setTier(userTier);
          setStatus(userStatus);
          setTrialEndDate(userTrialEndDate);
        } else {
          setTier('free');
          setStatus('free');
          setTrialEndDate(null);
        }
      }

      // Check trial eligibility if RevenueCat is available
      if (revenueCatInitialized && user.id) {
        try {
          const eligible = await revenueCatService.checkTrialEligibility(
            REVENUECAT_CONFIG.PRODUCTS.PREMIUM_MONTHLY_DEFAULT
          );
          setIsTrialEligible(eligible);
        } catch (error) {
          console.warn('[SubscriptionContext] Trial eligibility check failed:', error);
          setIsTrialEligible(false);
        }
      }
      
    } catch (err) {
      console.error('[SubscriptionContext] Error fetching subscription:', err);
      
      const handledError = subscriptionErrorHandler.handleError(err, 'Subscription');
      
      if (!handledError.silent && handledError.type !== 'network') {
        setError(handledError.message);
      }
      
      setTier('free');
      setStatus('free');
      setTrialEndDate(null);
      setIsTrialEligible(false);
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

  // Fetch subscription data when user changes or RevenueCat initializes
  useEffect(() => {
    fetchSubscriptionData();
    
    if (user) {
      subscriptionErrorHandler.reset();
    }
  }, [user, revenueCatInitialized]);

  // Computed properties
  const isPremium = tier === 'premium';
  const isTrialActive = status === 'trial' && trialEndDate && trialEndDate > new Date();
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
    hasActiveSubscription,
    isTrialActive,
    trialEndDate,
    daysRemainingInTrial,
    subscriptionStatus: status,
    refreshSubscriptionStatus,
    hasInitialLoadCompleted,
    isTrialEligible,
    revenueCatInitialized
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
