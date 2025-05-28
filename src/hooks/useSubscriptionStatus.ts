
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';

export interface SubscriptionStatus {
  subscriptionStatus: string;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  isPremium: boolean;
  hasAccess: boolean;
  daysRemainingInTrial: number;
  trialEndsAt: Date | null;
  shouldShowSubscriptionManager: boolean;
}

export const useSubscriptionStatus = (): SubscriptionStatus => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  
  const subscriptionStatus = profile?.subscription_status || 'free';
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const isTrialExpired = trialEndsAt ? new Date() > trialEndsAt : false;
  const isTrialActive = subscriptionStatus === 'trial' && !isTrialExpired;
  const isPremium = profile?.is_premium && (subscriptionStatus === 'active' || isTrialActive);
  const hasAccess = isPremium;

  const daysRemainingInTrial = trialEndsAt && isTrialActive 
    ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  // Show subscription manager if user needs to upgrade or trial is ending soon
  const shouldShowSubscriptionManager = !isPremium || (isTrialActive && daysRemainingInTrial <= 3);

  return {
    subscriptionStatus,
    isTrialActive,
    isTrialExpired,
    isPremium,
    hasAccess,
    daysRemainingInTrial,
    trialEndsAt,
    shouldShowSubscriptionManager
  };
};
