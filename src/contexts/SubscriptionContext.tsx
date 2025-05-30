
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
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
  
  // Performance monitoring
  lastLoadTime: number | null;
  cacheTimestamp: number | null;
}

interface CachedSubscriptionData {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  trialEndDate: Date | null;
  timestamp: number;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Cache duration: 2 minutes
const CACHE_DURATION = 2 * 60 * 1000;
const LOAD_TIMEOUT = 8000; // 8 second timeout

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [status, setStatus] = useState<SubscriptionStatus>('unknown');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialLoadCompleted, setHasInitialLoadCompleted] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState<Date | null>(null);
  const [lastLoadTime, setLastLoadTime] = useState<number | null>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  
  const cacheRef = useRef<CachedSubscriptionData | null>(null);
  const loadingRef = useRef<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Progressive loading with cache
  const fetchSubscriptionData = useCallback(async (forceRefresh = false): Promise<void> => {
    const startTime = Date.now();
    
    // Prevent concurrent loads
    if (loadingRef.current) return;
    
    if (!user) {
      setTier('free');
      setStatus('unknown');
      setIsLoading(false);
      setError(null);
      setHasInitialLoadCompleted(true);
      setTrialEndDate(null);
      setLastLoadTime(Date.now() - startTime);
      return;
    }

    // Use cache if available and fresh
    const now = Date.now();
    const cache = cacheRef.current;
    
    if (!forceRefresh && cache && (now - cache.timestamp) < CACHE_DURATION) {
      console.log('[SubscriptionContext] Using cached subscription data');
      setTier(cache.tier);
      setStatus(cache.status);
      setTrialEndDate(cache.trialEndDate);
      setIsLoading(false);
      setError(null);
      setHasInitialLoadCompleted(true);
      setCacheTimestamp(cache.timestamp);
      setLastLoadTime(Date.now() - startTime);
      return;
    }

    try {
      loadingRef.current = true;
      setIsLoading(true);
      setError(null);
      
      console.log('[SubscriptionContext] Fetching fresh subscription data for user:', user.id);
      
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutRef.current = setTimeout(() => {
          reject(new Error('Subscription fetch timeout'));
        }, LOAD_TIMEOUT);
      });
      
      // Race between fetch and timeout
      const fetchPromise = supabase
        .from('profiles')
        .select('subscription_tier, subscription_status, trial_ends_at, is_premium')
        .eq('id', user.id)
        .maybeSingle();
      
      const { data, error: supabaseError } = await Promise.race([fetchPromise, timeoutPromise]);
      
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (supabaseError) {
        throw supabaseError;
      }

      if (data) {
        const userTier = (data.subscription_tier as SubscriptionTier) || 'free';
        const userStatus = (data.subscription_status as SubscriptionStatus) || 'unknown';
        const userTrialEndDate = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
        
        // Update cache
        const cacheData: CachedSubscriptionData = {
          tier: userTier,
          status: userStatus,
          trialEndDate: userTrialEndDate,
          timestamp: now
        };
        cacheRef.current = cacheData;
        setCacheTimestamp(now);
        
        setTier(userTier);
        setStatus(userStatus);
        setTrialEndDate(userTrialEndDate);
        
        console.log('[SubscriptionContext] Updated subscription:', {
          tier: userTier,
          status: userStatus,
          trialEndDate: userTrialEndDate,
          isPremium: data.is_premium,
          cached: false
        });
      } else {
        // User profile doesn't exist yet, default to free
        const defaultData: CachedSubscriptionData = {
          tier: 'free',
          status: 'unknown',
          trialEndDate: null,
          timestamp: now
        };
        cacheRef.current = defaultData;
        setCacheTimestamp(now);
        
        setTier('free');
        setStatus('unknown');
        setTrialEndDate(null);
        console.log('[SubscriptionContext] No profile found, defaulting to free tier');
      }
    } catch (err) {
      console.error('[SubscriptionContext] Error fetching subscription:', err);
      
      // Clear timeout on error
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Use the error handler to categorize and potentially show the error
      const handledError = subscriptionErrorHandler.handleError(err, 'Subscription');
      
      // Only set error state for critical errors that aren't silenced
      if (!handledError.silent && handledError.type !== 'network') {
        setError(handledError.message);
      }
      
      // If we have cached data and this is a network error, use cache
      const cache = cacheRef.current;
      if (cache && handledError.type === 'network') {
        console.log('[SubscriptionContext] Using stale cache due to network error');
        setTier(cache.tier);
        setStatus(cache.status);
        setTrialEndDate(cache.trialEndDate);
        setCacheTimestamp(cache.timestamp);
      } else {
        // Default to free tier on error
        setTier('free');
        setStatus('unknown');
        setTrialEndDate(null);
      }
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
      setHasInitialLoadCompleted(true);
      setLastLoadTime(Date.now() - startTime);
    }
  }, [user]);

  const refreshSubscription = useCallback(async (): Promise<void> => {
    await fetchSubscriptionData(true);
  }, [fetchSubscriptionData]);

  const refreshSubscriptionStatus = useCallback(async (): Promise<void> => {
    await fetchSubscriptionData(true);
  }, [fetchSubscriptionData]);

  // Fetch subscription data when user changes
  useEffect(() => {
    fetchSubscriptionData();
    
    // Reset error handler when user changes
    if (user) {
      subscriptionErrorHandler.reset();
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user, fetchSubscriptionData]);

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
    hasInitialLoadCompleted,
    
    // Performance monitoring
    lastLoadTime,
    cacheTimestamp
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
