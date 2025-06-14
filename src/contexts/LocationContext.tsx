
import * as React from 'react';
import { SessionTrackingService } from '@/services/sessionTrackingService';

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

const LocationContext = React.createContext<LocationContextType | undefined>(undefined);

const DEFAULT_LOCATION: LocationData = {
  country: 'DEFAULT',
  currency: 'USD',
  timezone: 'UTC'
};

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [locationData, setLocationData] = React.useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const detectLocation = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('[LocationContext] Starting location detection');
      
      // Use the existing SessionTrackingService for consistent detection
      const detectedLocation = await SessionTrackingService.detectLocation();
      
      if (detectedLocation) {
        console.log('[LocationContext] Location detected:', detectedLocation);
        setLocationData(detectedLocation);
      } else {
        console.log('[LocationContext] Using default location');
        setLocationData(DEFAULT_LOCATION);
      }
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

  React.useEffect(() => {
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
  const context = React.useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
