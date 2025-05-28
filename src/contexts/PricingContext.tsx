import React, { createContext, useContext, useEffect, useState } from 'react';
import { locationPricingService, PricingTier } from '@/services/pricing/locationPricing';

interface PricingContextValue {
  pricing: PricingTier;
  isLoading: boolean;
  formatPrice: (amount: number) => string;
  refreshPricing: () => Promise<void>;
}

const PricingContext = createContext<PricingContextValue | undefined>(undefined);

export const usePricing = () => {
  const context = useContext(PricingContext);
  if (context === undefined) {
    throw new Error('usePricing must be used within a PricingProvider');
  }
  return context;
};

interface PricingProviderProps {
  children: React.ReactNode;
}

export const PricingProvider: React.FC<PricingProviderProps> = ({ children }) => {
  const [pricing, setPricing] = useState<PricingTier>({
    monthly: 999,
    yearly: 9999,
    currency: 'USD',
    currencySymbol: '$'
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadPricing = async () => {
    try {
      setIsLoading(true);
      const userPricing = await locationPricingService.getPricingForUser();
      setPricing(userPricing);
    } catch (error) {
      console.error('Failed to load pricing:', error);
      // Keep default pricing
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPricing();
  }, []);

  const formatPrice = (amount: number): string => {
    return locationPricingService.formatPrice(amount, pricing.currency, pricing.currencySymbol);
  };

  const refreshPricing = async () => {
    await loadPricing();
  };

  const value: PricingContextValue = {
    pricing,
    isLoading,
    formatPrice,
    refreshPricing
  };

  return (
    <PricingContext.Provider value={value}>
      {children}
    </PricingContext.Provider>
  );
};
