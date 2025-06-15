
import { useState, useEffect } from 'react';
import { REVENUECAT_CONFIG } from '@/config/revenueCatConfig';
import { revenueCatService } from '@/services/revenuecat/revenueCatService';
import { createLogger } from '@/utils/logger';

const logger = createLogger('LocationPricing');

interface LocationPricing {
  country: string;
  currency: string;
  price: string;
  productId: string;
  region: string;
}

const DEFAULT_PRICING: LocationPricing = {
  country: 'Global',
  currency: 'USD',
  price: '$4.99',
  productId: REVENUECAT_CONFIG.PRODUCTS.PREMIUM_MONTHLY_DEFAULT,
  region: 'Global'
};

const REGION_PRICING: Record<string, LocationPricing> = {
  IN: {
    country: 'India',
    currency: 'INR',
    price: '₹99',
    productId: REVENUECAT_CONFIG.PRODUCTS.PREMIUM_MONTHLY_IN,
    region: 'India'
  },
  US: {
    country: 'United States',
    currency: 'USD',
    price: '$4.99',
    productId: REVENUECAT_CONFIG.PRODUCTS.PREMIUM_MONTHLY_US,
    region: 'United States'
  },
  GB: {
    country: 'United Kingdom',
    currency: 'GBP',
    price: '£3.99',
    productId: REVENUECAT_CONFIG.PRODUCTS.PREMIUM_MONTHLY_GB,
    region: 'United Kingdom'
  }
};

export const useLocationPricing = () => {
  const [pricing, setPricing] = useState<LocationPricing>(DEFAULT_PRICING);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const detectLocationAndPricing = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Try to detect location using multiple methods
        let countryCode: string | null = null;

        // Method 1: Try browser geolocation API with timeout
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Geolocation timeout')), 5000);
            
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                clearTimeout(timeout);
                resolve(pos);
              },
              (err) => {
                clearTimeout(timeout);
                reject(err);
              },
              { timeout: 4000, enableHighAccuracy: false }
            );
          });

          // Use a geocoding service to convert coordinates to country
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          try {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`,
              { signal: controller.signal }
            );
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const data = await response.json();
              countryCode = data.countryCode;
            }
          } catch (fetchError) {
            clearTimeout(timeoutId);
            throw fetchError;
          }
        } catch (geoError) {
          logger.debug('Geolocation failed', geoError);
        }

        // Method 2: Fallback to IP-based detection
        if (!countryCode) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            try {
              const response = await fetch('https://ipapi.co/json/', {
                signal: controller.signal
              });
              
              clearTimeout(timeoutId);
              
              if (response.ok) {
                const data = await response.json();
                countryCode = data.country_code;
              }
            } catch (fetchError) {
              clearTimeout(timeoutId);
              throw fetchError;
            }
          } catch (ipError) {
            logger.debug('IP geolocation failed', ipError);
          }
        }

        // Method 3: Use browser timezone as fallback
        if (!countryCode) {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const timezoneToCountry: Record<string, string> = {
            'Asia/Kolkata': 'IN',
            'Asia/Calcutta': 'IN',
            'America/New_York': 'US',
            'America/Los_Angeles': 'US',
            'America/Chicago': 'US',
            'Europe/London': 'GB'
          };
          
          countryCode = timezoneToCountry[timezone];
        }

        // Set pricing based on detected country
        const detectedPricing = countryCode && REGION_PRICING[countryCode] 
          ? REGION_PRICING[countryCode] 
          : DEFAULT_PRICING;

        setPricing(detectedPricing);
        
        logger.debug('Location detected', {
          countryCode,
          pricing: detectedPricing
        });

      } catch (err) {
        logger.error('Error detecting location', err);
        setError('Failed to detect location');
        setPricing(DEFAULT_PRICING);
      } finally {
        setIsLoading(false);
      }
    };

    detectLocationAndPricing();
  }, []);

  const getPricingForCountry = (countryCode: string): LocationPricing => {
    return REGION_PRICING[countryCode] || DEFAULT_PRICING;
  };

  return {
    pricing,
    isLoading,
    error,
    getPricingForCountry
  };
};
