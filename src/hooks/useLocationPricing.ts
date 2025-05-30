
import { useState, useEffect } from 'react';

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
  const [pricing, setPricing] = useState<LocationPricing>(PRICING_MAP.DEFAULT);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const detectLocation = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Try IP-based geolocation first
        const response = await fetch('https://ipapi.co/json/');
        
        if (!response.ok) {
          throw new Error('Failed to fetch location');
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.reason || 'Location detection failed');
        }

        const countryCode = data.country_code;
        
        if (countryCode && PRICING_MAP[countryCode]) {
          setPricing(PRICING_MAP[countryCode]);
        } else {
          setPricing(PRICING_MAP.DEFAULT);
        }

        console.log('[useLocationPricing] Detected location:', {
          country: data.country_name,
          countryCode,
          pricing: PRICING_MAP[countryCode] || PRICING_MAP.DEFAULT
        });

      } catch (err) {
        console.error('[useLocationPricing] Location detection failed:', err);
        setError(err instanceof Error ? err.message : 'Location detection failed');
        setPricing(PRICING_MAP.DEFAULT);
      } finally {
        setIsLoading(false);
      }
    };

    detectLocation();
  }, []);

  return {
    pricing,
    isLoading,
    error,
    refreshLocation: () => {
      setIsLoading(true);
      setError(null);
      // Re-trigger the effect by clearing and setting pricing
      setPricing(PRICING_MAP.DEFAULT);
    }
  };
};
