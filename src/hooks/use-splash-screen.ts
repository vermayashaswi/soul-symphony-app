
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface UseSplashScreenOptions {
  minDisplayTime?: number;
  enabledInDev?: boolean;
}

export const useSplashScreen = (options: UseSplashScreenOptions = {}) => {
  const { 
    minDisplayTime = 1500, // Reduced further
    enabledInDev = false
  } = options;
  
  const [isVisible, setIsVisible] = useState(false); // Start as hidden by default
  const [isAppReady, setIsAppReady] = useState(true); // Start as ready by default
  const { user, isLoading: authLoading } = useAuth();

  const [startTime] = useState(Date.now());

  // Emergency timeout to prevent infinite blocking
  useEffect(() => {
    const emergencyTimeout = setTimeout(() => {
      console.log('[SplashScreen] Emergency timeout triggered, forcing app ready');
      setIsAppReady(true);
      setIsVisible(false);
    }, 5000); // 5 second maximum

    return () => clearTimeout(emergencyTimeout);
  }, []);

  // Check if app is ready based on auth state and other conditions
  useEffect(() => {
    const checkAppReady = async () => {
      // For development, don't show splash unless explicitly enabled
      if (process.env.NODE_ENV === 'development' && !enabledInDev) {
        setIsAppReady(true);
        setIsVisible(false);
        return;
      }

      // For marketing routes, never show splash
      if (window.location.pathname === '/' || 
          window.location.pathname.startsWith('/blog') ||
          window.location.pathname.startsWith('/faq') ||
          window.location.pathname.startsWith('/privacy')) {
        console.log('[SplashScreen] Marketing route detected, skipping splash');
        setIsAppReady(true);
        setIsVisible(false);
        return;
      }

      // Only show splash for app routes
      if (!window.location.pathname.startsWith('/app/')) {
        setIsAppReady(true);
        setIsVisible(false);
        return;
      }

      // For app routes, show splash but with timeout protection
      setIsVisible(true);
      
      // Don't wait for auth if it's taking too long
      const authTimeout = setTimeout(() => {
        console.log('[SplashScreen] Auth timeout, proceeding anyway');
        setIsAppReady(true);
      }, 3000);

      // Wait for auth to finish loading (with timeout)
      if (!authLoading) {
        clearTimeout(authTimeout);
        
        // Simulate minimal app initialization
        await new Promise(resolve => setTimeout(resolve, 200));

        // Check if minimum display time has passed
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

        setTimeout(() => {
          setIsAppReady(true);
        }, remainingTime);
      }

      return () => clearTimeout(authTimeout);
    };

    checkAppReady();
  }, [authLoading, minDisplayTime, startTime, enabledInDev]);

  // Hide splash screen when app is ready
  const hideSplashScreen = useCallback(() => {
    setIsVisible(false);
  }, []);

  return {
    isVisible,
    isAppReady,
    hideSplashScreen
  };
};
