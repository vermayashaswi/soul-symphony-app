
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface LocationContextType {
  country: string | null;
  currency: string | null;
  isLoading: boolean;
  error: string | null;
  refreshLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [country, setCountry] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocationData = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Try to get location from IP
      const response = await fetch('https://ipapi.co/json/');
      if (!response.ok) {
        throw new Error('Failed to fetch location data');
      }
      
      const data = await response.json();
      setCountry(data.country_code || 'US');
      setCurrency(data.currency || 'USD');
      
      console.log('[LocationContext] Location data fetched:', {
        country: data.country_code,
        currency: data.currency
      });
    } catch (err) {
      console.error('[LocationContext] Error fetching location:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      // Default to US if location fetch fails
      setCountry('US');
      setCurrency('USD');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshLocation = async (): Promise<void> => {
    await fetchLocationData();
  };

  useEffect(() => {
    fetchLocationData();
  }, []);

  const contextValue: LocationContextType = {
    country,
    currency,
    isLoading,
    error,
    refreshLocation
  };

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
