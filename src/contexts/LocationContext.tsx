
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface LocationData {
  country: string;
  currency: string;
  timezone: string;
}

interface LocationContextType {
  locationData: LocationData | null;
  isLoading: boolean;
  error: string | null;
  refreshLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const DEFAULT_LOCATION: LocationData = {
  country: 'DEFAULT',
  currency: 'USD',
  timezone: 'UTC'
};

export function LocationProvider({ children }: { children: ReactNode }) {
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const detectLocation = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('[LocationContext] Starting location detection');
      
      // Enhanced location detection with timezone (normalize legacy timezones)
      let detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      
      // Normalize legacy timezone identifiers
      if (detectedTimezone === 'Asia/Calcutta') {
        detectedTimezone = 'Asia/Kolkata';
        console.log('[LocationContext] Normalized legacy timezone Asia/Calcutta to Asia/Kolkata');
      }
      
      console.log('[LocationContext] Detected timezone:', detectedTimezone);

      let detectedCountry = 'DEFAULT';
      let detectedCurrency = 'USD';

      // Comprehensive timezone-based country mapping for all 24 supported countries
      const timezoneCountryMap: Record<string, { country: string; currency: string }> = {
        // India
        'Asia/Kolkata': { country: 'IN', currency: 'INR' },
        'Asia/Calcutta': { country: 'IN', currency: 'INR' },
        
        // United States (multiple zones)
        'America/New_York': { country: 'US', currency: 'USD' },
        'America/Los_Angeles': { country: 'US', currency: 'USD' },
        'America/Chicago': { country: 'US', currency: 'USD' },
        'America/Denver': { country: 'US', currency: 'USD' },
        'America/Anchorage': { country: 'US', currency: 'USD' },
        'Pacific/Honolulu': { country: 'US', currency: 'USD' },
        'America/Phoenix': { country: 'US', currency: 'USD' },
        'America/Detroit': { country: 'US', currency: 'USD' },
        
        // United Kingdom
        'Europe/London': { country: 'GB', currency: 'GBP' },
        
        // Canada (multiple zones)
        'America/Toronto': { country: 'CA', currency: 'CAD' },
        'America/Vancouver': { country: 'CA', currency: 'CAD' },
        'America/Winnipeg': { country: 'CA', currency: 'CAD' },
        'America/Edmonton': { country: 'CA', currency: 'CAD' },
        'America/Halifax': { country: 'CA', currency: 'CAD' },
        
        // Australia (multiple zones)
        'Australia/Sydney': { country: 'AU', currency: 'AUD' },
        'Australia/Melbourne': { country: 'AU', currency: 'AUD' },
        'Australia/Brisbane': { country: 'AU', currency: 'AUD' },
        'Australia/Perth': { country: 'AU', currency: 'AUD' },
        'Australia/Adelaide': { country: 'AU', currency: 'AUD' },
        'Australia/Hobart': { country: 'AU', currency: 'AUD' },
        'Australia/Darwin': { country: 'AU', currency: 'AUD' },
        
        // Europe
        'Europe/Berlin': { country: 'DE', currency: 'EUR' },
        'Europe/Paris': { country: 'FR', currency: 'EUR' },
        'Europe/Rome': { country: 'IT', currency: 'EUR' },
        'Europe/Madrid': { country: 'ES', currency: 'EUR' },
        'Europe/Amsterdam': { country: 'NL', currency: 'EUR' },
        'Europe/Stockholm': { country: 'SE', currency: 'EUR' },
        'Europe/Oslo': { country: 'NO', currency: 'EUR' },
        'Europe/Copenhagen': { country: 'DK', currency: 'EUR' },
        
        // Middle East
        'Asia/Dubai': { country: 'AE', currency: 'AED' },
        'Asia/Riyadh': { country: 'SA', currency: 'SAR' },
        
        // Asia
        'Asia/Tokyo': { country: 'JP', currency: 'JPY' },
        'Asia/Seoul': { country: 'KR', currency: 'KRW' },
        'Asia/Singapore': { country: 'SG', currency: 'USD' },
        'Asia/Kuala_Lumpur': { country: 'MY', currency: 'USD' },
        'Asia/Bangkok': { country: 'TH', currency: 'USD' },
        
        // Americas
        'America/Mexico_City': { country: 'MX', currency: 'MXN' },
        'America/Tijuana': { country: 'MX', currency: 'MXN' },
        'America/Sao_Paulo': { country: 'BR', currency: 'BRL' },
        'America/Manaus': { country: 'BR', currency: 'BRL' },
        'America/Rio_Branco': { country: 'BR', currency: 'BRL' },
        
        // Africa
        'Africa/Johannesburg': { country: 'ZA', currency: 'USD' },
        'Africa/Lagos': { country: 'NG', currency: 'USD' },
      };

      const timezoneMatch = timezoneCountryMap[detectedTimezone];
      if (timezoneMatch) {
        detectedCountry = timezoneMatch.country;
        detectedCurrency = timezoneMatch.currency;
      } else {
        // Fallback to language-based detection
        const language = navigator.language || navigator.languages?.[0] || 'en-US';
        const region = language.split('-')[1]?.toUpperCase();
        
        const regionMap: Record<string, { country: string; currency: string }> = {
          'IN': { country: 'IN', currency: 'INR' },
          'US': { country: 'US', currency: 'USD' },
          'GB': { country: 'GB', currency: 'GBP' },
          'CA': { country: 'CA', currency: 'CAD' },
          'AU': { country: 'AU', currency: 'AUD' },
          'DE': { country: 'DE', currency: 'EUR' },
          'FR': { country: 'FR', currency: 'EUR' },
          'IT': { country: 'IT', currency: 'EUR' },
          'ES': { country: 'ES', currency: 'EUR' },
          'NL': { country: 'NL', currency: 'EUR' },
          'SE': { country: 'SE', currency: 'EUR' },
          'NO': { country: 'NO', currency: 'EUR' },
          'DK': { country: 'DK', currency: 'EUR' },
          'AE': { country: 'AE', currency: 'AED' },
          'SA': { country: 'SA', currency: 'SAR' },
          'JP': { country: 'JP', currency: 'JPY' },
          'KR': { country: 'KR', currency: 'KRW' },
          'SG': { country: 'SG', currency: 'USD' },
          'MY': { country: 'MY', currency: 'USD' },
          'TH': { country: 'TH', currency: 'USD' },
          'MX': { country: 'MX', currency: 'MXN' },
          'BR': { country: 'BR', currency: 'BRL' },
          'ZA': { country: 'ZA', currency: 'USD' },
          'NG': { country: 'NG', currency: 'USD' },
        };

        const regionMatch = regionMap[region || ''];
        if (regionMatch) {
          detectedCountry = regionMatch.country;
          detectedCurrency = regionMatch.currency;
        }
      }

      const detectedLocation: LocationData = {
        country: detectedCountry,
        currency: detectedCurrency,
        timezone: detectedTimezone
      };
      
      console.log('[LocationContext] Location detected:', detectedLocation);
      setLocationData(detectedLocation);
    } catch (err) {
      console.error('[LocationContext] Location detection failed:', err);
      setError(err instanceof Error ? err.message : 'Location detection failed');
      const fallbackLocation: LocationData = {
        country: 'DEFAULT',
        currency: 'USD',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      };
      setLocationData(fallbackLocation);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshLocation = async (): Promise<void> => {
    await detectLocation();
  };

  useEffect(() => {
    detectLocation();
  }, []);

  const value = {
    locationData,
    isLoading,
    error,
    refreshLocation,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
