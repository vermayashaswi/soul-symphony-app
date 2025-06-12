
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface UseSplashScreenOptions {
  minDisplayTime?: number;
  enabledInDev?: boolean;
}

export const useSplashScreen = (options: UseSplashScreenOptions = {}) => {
  const { 
    minDisplayTime = 3000, 
    enabledInDev = true 
  } = options;
  
  const [isVisible, setIsVisible] = useState(true);
  const [isAppReady, setIsAppReady] = useState(false);
  const { user, loading: authLoading } = useAuth();

  const [startTime] = useState(Date.now());

  // Check if app is ready based on auth state and other conditions
  useEffect(() => {
    const checkAppReady = async () => {
      // Wait for auth to finish loading
      if (authLoading) return;

      // Simulate additional app initialization tasks
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if minimum display time has passed
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

      setTimeout(() => {
        setIsAppReady(true);
      }, remainingTime);
    };

    checkAppReady();
  }, [authLoading, minDisplayTime, startTime]);

  // Hide splash screen when app is ready
  const hideSplashScreen = useCallback(() => {
    setIsVisible(false);
  }, []);

  // Don't show splash in development unless explicitly enabled
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && !enabledInDev) {
      setIsVisible(false);
      setIsAppReady(true);
    }
  }, [enabledInDev]);

  return {
    isVisible,
    isAppReady,
    hideSplashScreen
  };
};
