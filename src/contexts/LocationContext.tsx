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
      
      console.log('[LocationContext] Starting simplified location detection');
      
      // Simplified location detection using browser timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const detectedLocation: LocationData = {
        country: 'DEFAULT',
        currency: 'USD',
        timezone: timezone || 'UTC'
      };
      
      console.log('[LocationContext] Location detected:', detectedLocation);
      setLocationData(detectedLocation);
    } catch (err) {
      console.error('[LocationContext] Location detection failed:', err);
      setError(err instanceof Error ? err.message : 'Location detection failed');
      setLocationData(DEFAULT_LOCATION);
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