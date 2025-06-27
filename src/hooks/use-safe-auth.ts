
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';

export interface SafeAuthState {
  user: any | null;
  isLoading: boolean;
  error: string | null;
  isAvailable: boolean;
}

export const useSafeAuth = (): SafeAuthState => {
  const [authState, setAuthState] = useState<SafeAuthState>({
    user: null,
    isLoading: true,
    error: null,
    isAvailable: false
  });

  useEffect(() => {
    const checkAuthAvailability = () => {
      try {
        console.log('[useSafeAuth] Checking auth availability...');
        const auth = useAuth();
        
        setAuthState({
          user: auth.user,
          isLoading: auth.isLoading,
          error: null,
          isAvailable: true
        });
        
        console.log('[useSafeAuth] Auth context available:', {
          hasUser: !!auth.user,
          isLoading: auth.isLoading
        });
      } catch (error) {
        console.warn('[useSafeAuth] Auth context not available:', error);
        setAuthState({
          user: null,
          isLoading: true,
          error: 'Auth context not available',
          isAvailable: false
        });
      }
    };

    // Check immediately
    checkAuthAvailability();

    // Only set up periodic checks if auth is not available initially
    let interval: NodeJS.Timeout | null = null;
    if (!authState.isAvailable) {
      interval = setInterval(checkAuthAvailability, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [authState.isAvailable]);

  return authState;
};
