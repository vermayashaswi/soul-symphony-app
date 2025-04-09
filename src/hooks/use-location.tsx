
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

type LocationState = {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
  permissionState: PermissionState | null;
};

export type PermissionState = 'granted' | 'denied' | 'prompt' | null;

export const useLocation = () => {
  const [state, setState] = useState<LocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: true,
    permissionState: null,
  });

  const requestLocationPermission = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Check if geolocation is available
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by your browser');
      }

      // Check permission status if available
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        setState(prev => ({ ...prev, permissionState: permission.state as PermissionState }));
        
        // Set up listener for permission changes
        permission.addEventListener('change', () => {
          setState(prev => ({ ...prev, permissionState: permission.state as PermissionState }));
          if (permission.state === 'granted') {
            getCurrentPosition();
          }
        });
      }

      // Get current position
      const getCurrentPosition = () => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setState(prev => ({
              ...prev,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              loading: false,
              error: null,
              permissionState: 'granted',
            }));
          },
          (error) => {
            console.error('Error getting location:', error);
            let errorMessage = 'Failed to get your location';
            
            if (error.code === 1) {
              errorMessage = 'Location permission denied';
              setState(prev => ({ 
                ...prev, 
                error: errorMessage, 
                loading: false,
                permissionState: 'denied' 
              }));
            } else {
              setState(prev => ({ 
                ...prev, 
                error: errorMessage, 
                loading: false 
              }));
            }
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      };
      
      getCurrentPosition();
      
    } catch (error) {
      console.error('Location error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'An unknown error occurred', 
        loading: false 
      }));
    }
  }, []);

  // Initial request on mount
  useEffect(() => {
    requestLocationPermission();
  }, [requestLocationPermission]);

  return {
    ...state,
    requestLocationPermission,
  };
};
