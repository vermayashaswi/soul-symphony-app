
import { useState, useCallback } from 'react';
import { useSubscription } from './use-subscription';

export interface PremiumAccessControl {
  canAccessChat: boolean;
  canAccessInsights: boolean;
  canAccessFeature: (feature: string) => boolean;
  showUpgradePrompt: (feature: string, description?: string) => void;
  upgradePromptState: {
    isOpen: boolean;
    feature: string;
    description: string;
  };
  closeUpgradePrompt: () => void;
}

export function usePremiumAccess(): PremiumAccessControl {
  const { hasActiveTrialOrSubscription } = useSubscription();
  const [upgradePromptState, setUpgradePromptState] = useState({
    isOpen: false,
    feature: '',
    description: ''
  });

  const canAccessChat = hasActiveTrialOrSubscription;
  const canAccessInsights = hasActiveTrialOrSubscription;

  const canAccessFeature = useCallback((feature: string): boolean => {
    // For now, all premium features require active subscription or trial
    return hasActiveTrialOrSubscription;
  }, [hasActiveTrialOrSubscription]);

  const showUpgradePrompt = useCallback((feature: string, description?: string) => {
    setUpgradePromptState({
      isOpen: true,
      feature,
      description: description || `This feature requires a premium subscription to continue.`
    });
  }, []);

  const closeUpgradePrompt = useCallback(() => {
    setUpgradePromptState(prev => ({
      ...prev,
      isOpen: false
    }));
  }, []);

  return {
    canAccessChat,
    canAccessInsights,
    canAccessFeature,
    showUpgradePrompt,
    upgradePromptState,
    closeUpgradePrompt
  };
}
