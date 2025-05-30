
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SubscriptionLoadingContextType {
  isSubscriptionLoading: boolean;
  setIsSubscriptionLoading: (loading: boolean) => void;
  subscriptionError: string | null;
  setSubscriptionError: (error: string | null) => void;
}

const SubscriptionLoadingContext = createContext<SubscriptionLoadingContextType | undefined>(undefined);

export const SubscriptionLoadingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);

  const contextValue: SubscriptionLoadingContextType = {
    isSubscriptionLoading,
    setIsSubscriptionLoading,
    subscriptionError,
    setSubscriptionError
  };

  return (
    <SubscriptionLoadingContext.Provider value={contextValue}>
      {children}
    </SubscriptionLoadingContext.Provider>
  );
};

export const useSubscriptionLoading = (): SubscriptionLoadingContextType => {
  const context = useContext(SubscriptionLoadingContext);
  if (context === undefined) {
    throw new Error('useSubscriptionLoading must be used within a SubscriptionLoadingProvider');
  }
  return context;
};
