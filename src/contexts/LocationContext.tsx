
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
      
      // Enhanced location detection with timezone
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      console.log('[LocationContext] Detected timezone:', detectedTimezone);

      let detectedCountry = 'DEFAULT';
      let detectedCurrency = 'USD';

      // Timezone-based country mapping (enhanced version)
      const timezoneCountryMap: Record<string, { country: string; currency: string }> = {
        'Asia/Kolkata': { country: 'IN', currency: 'INR' },
        'Asia/Calcutta': { country: 'IN', currency: 'INR' },
        'America/New_York': { country: 'US', currency: 'USD' },
        'America/Los_Angeles': { country: 'US', currency: 'USD' },
        'America/Chicago': { country: 'US', currency: 'USD' },
        'America/Denver': { country: 'US', currency: 'USD' },
        'Europe/London': { country: 'GB', currency: 'GBP' },
        'America/Toronto': { country: 'CA', currency: 'CAD' },
        'America/Vancouver': { country: 'CA', currency: 'CAD' },
        'Australia/Sydney': { country: 'AU', currency: 'AUD' },
        'Australia/Melbourne': { country: 'AU', currency: 'AUD' },
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

export function useLocationData() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocationData must be used within a LocationProvider');
  }
  return context;
}
