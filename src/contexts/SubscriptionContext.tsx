
import React, { createContext, useContext, ReactNode } from 'react';
import { useAppInitializationContext } from '@/contexts/AppInitializationContext';
import type { SubscriptionTier, SubscriptionStatus } from '@/contexts/AppInitializationContext';


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
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { subscriptionData, isAppReady } = useAppInitializationContext();

  // Simplified refresh functions that don't actually refetch during initialization
  const refreshSubscription = async (): Promise<void> => {
    console.log('[SubscriptionContext] Refresh requested - data comes from AppInitializationContext (hardcoded for new users)');
  };

  const refreshSubscriptionStatus = async (): Promise<void> => {
    console.log('[SubscriptionContext] Refresh status requested - data comes from AppInitializationContext (hardcoded for new users)');
  };

  // Use data from AppInitializationContext or defaults
  const defaultData = {
    tier: 'free' as SubscriptionTier,
    status: 'free' as SubscriptionStatus,
    trialEndDate: null,
    isTrialEligible: false,
    isPremium: false,
    hasActiveSubscription: false,
    isTrialActive: false,
    daysRemainingInTrial: 0
  };

  const currentData = subscriptionData || defaultData;

  const contextValue: SubscriptionContextType = {
    tier: currentData.tier,
    status: currentData.status,
    isLoading: !isAppReady, // Loading until app is fully ready
    error: null, // Errors handled in AppInitializationContext
    refreshSubscription,
    isPremium: currentData.isPremium,
    hasActiveSubscription: currentData.hasActiveSubscription,
    
    // Additional properties
    isTrialActive: currentData.isTrialActive,
    trialEndDate: currentData.trialEndDate,
    daysRemainingInTrial: currentData.daysRemainingInTrial,
    subscriptionStatus: currentData.status, // Alias for status
    refreshSubscriptionStatus,
    hasInitialLoadCompleted: isAppReady, // Complete when app is ready
    isTrialEligible: currentData.isTrialEligible
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
