import { useState, useEffect } from 'react';
import { useLocationData } from '@/contexts/LocationContext';

interface LocationPricing {
  countryCode: string;
  country: string;
  currency: string;
  price: string;
  productId: string;
}

const PRICING_MAP: Record<string, LocationPricing> = {
  IN: { countryCode: 'IN', country: 'India', currency: 'INR', price: '₹99', productId: 'premium_monthly_in' },
  US: { countryCode: 'US', country: 'United States', currency: 'USD', price: '$4.99', productId: 'premium_monthly_us' },
  GB: { countryCode: 'GB', country: 'United Kingdom', currency: 'GBP', price: '£3.99', productId: 'premium_monthly_gb' },
  CA: { countryCode: 'CA', country: 'Canada', currency: 'CAD', price: '$5.49', productId: 'premium_monthly_ca' },
  AU: { countryCode: 'AU', country: 'Australia', currency: 'AUD', price: '$6.49', productId: 'premium_monthly_au' },
  DE: { countryCode: 'DE', country: 'Germany', currency: 'EUR', price: '€4.99', productId: 'premium_monthly_de' },
  FR: { countryCode: 'FR', country: 'France', currency: 'EUR', price: '€4.99', productId: 'premium_monthly_fr' },
  IT: { countryCode: 'IT', country: 'Italy', currency: 'EUR', price: '€4.99', productId: 'premium_monthly_it' },
  ES: { countryCode: 'ES', country: 'Spain', currency: 'EUR', price: '€4.99', productId: 'premium_monthly_es' },
  NL: { countryCode: 'NL', country: 'Netherlands', currency: 'EUR', price: '€4.99', productId: 'premium_monthly_nl' },
  SE: { countryCode: 'SE', country: 'Sweden', currency: 'EUR', price: '€6.49', productId: 'premium_monthly_se' },
  NO: { countryCode: 'NO', country: 'Norway', currency: 'EUR', price: '€6.49', productId: 'premium_monthly_no' },
  DK: { countryCode: 'DK', country: 'Denmark', currency: 'EUR', price: '€6.49', productId: 'premium_monthly_dk' },
  AE: { countryCode: 'AE', country: 'UAE', currency: 'AED', price: '19.99 AED', productId: 'premium_monthly_ae' },
  SA: { countryCode: 'SA', country: 'Saudi Arabia', currency: 'SAR', price: '19.99 SAR', productId: 'premium_monthly_sa' },
  JP: { countryCode: 'JP', country: 'Japan', currency: 'JPY', price: '¥600', productId: 'premium_monthly_jp' },
  KR: { countryCode: 'KR', country: 'South Korea', currency: 'KRW', price: '₩5,900', productId: 'premium_monthly_kr' },
  SG: { countryCode: 'SG', country: 'Singapore', currency: 'USD', price: '$1.49', productId: 'premium_monthly_sg' },
  MY: { countryCode: 'MY', country: 'Malaysia', currency: 'USD', price: '$1.49', productId: 'premium_monthly_my' },
  TH: { countryCode: 'TH', country: 'Thailand', currency: 'USD', price: '$1.49', productId: 'premium_monthly_th' },
  MX: { countryCode: 'MX', country: 'Mexico', currency: 'MXN', price: 'MX$29.99', productId: 'premium_monthly_mx' },
  BR: { countryCode: 'BR', country: 'Brazil', currency: 'BRL', price: 'R$9.99', productId: 'premium_monthly_br' },
  ZA: { countryCode: 'ZA', country: 'South Africa', currency: 'USD', price: '$1.49', productId: 'premium_monthly_za' },
  NG: { countryCode: 'NG', country: 'Nigeria', currency: 'USD', price: '$0.99', productId: 'premium_monthly_ng' },
  DEFAULT: { countryCode: 'DEFAULT', country: 'Global', currency: 'USD', price: '$4.99', productId: 'premium_monthly_default' }
};

export const useLocationPricing = () => {
  const { locationData, isLoading: locationLoading, error: locationError } = useLocationData();
  const [pricing, setPricing] = useState<LocationPricing>(PRICING_MAP.DEFAULT);

  useEffect(() => {
    if (locationData && locationData.country) {
      const countryCode = locationData.country;
      const selectedPricing = PRICING_MAP[countryCode] || PRICING_MAP.DEFAULT;
      
      console.log('[useLocationPricing] Setting pricing based on location:', {
        countryCode,
        currency: locationData.currency,
        selectedPricing
      });
      
      setPricing(selectedPricing);
    } else if (!locationLoading) {
      // Only set default if location loading is complete
      setPricing(PRICING_MAP.DEFAULT);
    }
  }, [locationData, locationLoading]);

  return {
    pricing,
    isLoading: locationLoading,
    error: locationError,
    refreshLocation: async () => {
      // Location refresh is handled by the LocationContext
    }
  };
};
