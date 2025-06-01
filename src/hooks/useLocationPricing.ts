
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
  const [attemptCount, setAttemptCount] = useState(0);
  const maxAttempts = 3;

  useEffect(() => {
    const detectLocation = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('[useLocationPricing] Detecting location, attempt:', attemptCount + 1);

        // Try IP-based geolocation with timeout protection
        const controller = new AbortController();
        const signal = controller.signal;
        
        // Set timeout for the fetch
        const timeoutId = setTimeout(() => {
          controller.abort();
          throw new Error('Location detection timed out');
        }, 5000);
        
        try {
          const response = await fetch('https://ipapi.co/json/', { signal });
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch location: ${response.status}`);
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
          
          // Reset attempt count on success
          setAttemptCount(0);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }

      } catch (err) {
        console.error('[useLocationPricing] Location detection failed:', err);
        
        const errorMessage = err instanceof Error ? err.message : 'Location detection failed';
        setError(errorMessage);
        
        // Use default pricing
        setPricing(PRICING_MAP.DEFAULT);
        
        // Implement retry logic if we haven't exceeded max attempts
        if (attemptCount < maxAttempts - 1) {
          setAttemptCount(prev => prev + 1);
          // Will retry on next effect run
        }
      } finally {
        setIsLoading(false);
      }
    };

    detectLocation();
  }, [attemptCount]);

  return {
    pricing,
    isLoading,
    error,
    refreshLocation: () => {
      setIsLoading(true);
      setError(null);
      setAttemptCount(0);  // Reset attempt count to trigger a fresh attempt
    }
  };
};
