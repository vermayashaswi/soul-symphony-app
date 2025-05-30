
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface TrialAccessState {
  hasAccess: boolean;
  isTrialExpired: boolean;
  isLoading: boolean;
  daysRemaining: number;
  showSubscriptionModal: boolean;
  openSubscriptionModal: () => void;
  closeSubscriptionModal: () => void;
  loadTime: number | null;
}

export const useTrialAccess = (): TrialAccessState => {
  const { user } = useAuth();
  const { 
    isPremium, 
    isTrialActive, 
    daysRemainingInTrial, 
    hasActiveSubscription,
    isLoading: subscriptionLoading,
    hasInitialLoadCompleted,
    lastLoadTime
  } = useSubscription();
  
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [loadTime, setLoadTime] = useState<number | null>(null);

  // Safely compute access state
  const hasAccess = Boolean(isPremium || hasActiveSubscription || isTrialActive);
  const isTrialExpired = Boolean(!isTrialActive && !isPremium && !hasActiveSubscription && user);
  
  const openSubscriptionModal = useCallback(() => {
    console.log('[useTrialAccess] Opening subscription modal');
    setShowSubscriptionModal(true);
  }, []);
  
  const closeSubscriptionModal = useCallback(() => {
    console.log('[useTrialAccess] Closing subscription modal');
    setShowSubscriptionModal(false);
  }, []);

  // Track performance only
  useEffect(() => {
    if (hasInitialLoadCompleted && lastLoadTime) {
      setLoadTime(lastLoadTime);
    }
  }, [hasInitialLoadCompleted, lastLoadTime]);

  return {
    hasAccess,
    isTrialExpired,
    isLoading: subscriptionLoading || false,
    daysRemaining: daysRemainingInTrial || 0,
    showSubscriptionModal,
    openSubscriptionModal,
    closeSubscriptionModal,
    loadTime
  };
};
