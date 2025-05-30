
import { useState, useEffect } from 'react';
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
}

export const useTrialAccess = (): TrialAccessState => {
  const { user } = useAuth();
  const { 
    isPremium, 
    isTrialActive, 
    daysRemainingInTrial, 
    hasActiveSubscription,
    isLoading: subscriptionLoading 
  } = useSubscription();
  
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // Determine if user has access to premium features
  const hasAccess = isPremium || hasActiveSubscription || isTrialActive;
  const isTrialExpired = !isTrialActive && !isPremium && !hasActiveSubscription;
  
  const openSubscriptionModal = () => {
    setShowSubscriptionModal(true);
  };
  
  const closeSubscriptionModal = () => {
    setShowSubscriptionModal(false);
  };

  // Auto-open subscription modal when accessing premium features with expired trial
  useEffect(() => {
    if (user && isTrialExpired && !subscriptionLoading) {
      console.log('[useTrialAccess] Trial expired, user needs subscription');
    }
  }, [user, isTrialExpired, subscriptionLoading]);

  return {
    hasAccess,
    isTrialExpired,
    isLoading: subscriptionLoading,
    daysRemaining: daysRemainingInTrial,
    showSubscriptionModal,
    openSubscriptionModal,
    closeSubscriptionModal
  };
};
