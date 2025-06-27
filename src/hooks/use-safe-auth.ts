
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

    // Set up periodic checks in case auth becomes available later
    const interval = setInterval(checkAuthAvailability, 1000);

    return () => clearInterval(interval);
  }, []);

  return authState;
};
