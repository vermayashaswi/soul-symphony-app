import { useState, useEffect } from 'react';
import { useLocation } from '@/contexts/LocationContext';

interface PricingData {
  monthlyPrice: string;
  currency: string;
  countryCode: string;
}

export const useLocationPricing = () => {
  const [pricingData, setPricingData] = useState<PricingData>({
    monthlyPrice: '$4.99',
    currency: 'USD',
    countryCode: 'US'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Safely use location context with fallback
  let locationData: { country: string | null; currency: string | null; isLoading: boolean; error: string | null } | null = null;
  
  try {
    locationData = useLocation();
  } catch (err) {
    console.warn('[useLocationPricing] LocationProvider not available, using defaults');
    locationData = null;
  }

  useEffect(() => {
    const fetchPricing = async () => {
      if (locationData?.isLoading) {
        setIsLoading(true);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const country = locationData?.country || 'US';
        const currency = locationData?.currency || 'USD';

        // Simple pricing logic based on country
        let monthlyPrice = '$4.99';
        
        switch (country) {
          case 'IN':
            monthlyPrice = '₹299';
            break;
          case 'GB':
            monthlyPrice = '£3.99';
            break;
          case 'CA':
            monthlyPrice = 'C$6.99';
            break;
          case 'AU':
            monthlyPrice = 'A$7.99';
            break;
          case 'EU':
          case 'DE':
          case 'FR':
          case 'ES':
          case 'IT':
            monthlyPrice = '€4.99';
            break;
          default:
            monthlyPrice = '$4.99';
        }

        setPricingData({
          monthlyPrice,
          currency,
          countryCode: country
        });

        console.log('[useLocationPricing] Pricing data updated:', {
          monthlyPrice,
          currency,
          countryCode: country
        });

      } catch (err) {
        console.error('[useLocationPricing] Error fetching pricing:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        
        // Keep defaults on error
        setPricingData({
          monthlyPrice: '$4.99',
          currency: 'USD',
          countryCode: 'US'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPricing();
  }, [locationData?.country, locationData?.currency, locationData?.isLoading]);

  return {
    ...pricingData,
    isLoading,
    error
  };
};
