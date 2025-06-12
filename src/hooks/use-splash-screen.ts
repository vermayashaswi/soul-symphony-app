
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface UseSplashScreenOptions {
  minDisplayTime?: number;
  enabledInDev?: boolean;
}

export const useSplashScreen = (options: UseSplashScreenOptions = {}) => {
  const { 
    minDisplayTime = 1500,
    enabledInDev = false
  } = options;
  
  const [isVisible, setIsVisible] = useState(false);
  const [isAppReady, setIsAppReady] = useState(true);
  const { user, isLoading: authLoading } = useAuth();
  const [startTime] = useState(Date.now());

  console.log('[useSplashScreen] Hook initialized', {
    pathname: window.location.pathname,
    enabledInDev,
    authLoading,
    hasUser: !!user
  });

  // Check if we should show splash at all
  useEffect(() => {
    const currentPath = window.location.pathname;
    
    console.log('[useSplashScreen] Evaluating splash visibility for path:', currentPath);
    
    // NEVER show splash for marketing routes
    if (currentPath === '/' || 
        currentPath.startsWith('/blog') ||
        currentPath.startsWith('/faq') ||
        currentPath.startsWith('/privacy') ||
        currentPath.startsWith('/download')) {
      console.log('[useSplashScreen] Marketing route - splash disabled');
      setIsVisible(false);
      setIsAppReady(true);
      return;
    }

    // For development, don't show splash unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !enabledInDev) {
      console.log('[useSplashScreen] Development mode - splash disabled');
      setIsVisible(false);
      setIsAppReady(true);
      return;
    }

    // Only show splash for app routes in production
    if (currentPath.startsWith('/app/')) {
      console.log('[useSplashScreen] App route detected - enabling splash');
      setIsVisible(true);
      setIsAppReady(false);
      
      // Simple timeout-based completion
      const timer = setTimeout(() => {
        console.log('[useSplashScreen] Timer completed - hiding splash');
        setIsAppReady(true);
        setIsVisible(false);
      }, minDisplayTime);
      
      return () => clearTimeout(timer);
    } else {
      console.log('[useSplashScreen] Non-app route - splash disabled');
      setIsVisible(false);
      setIsAppReady(true);
    }
  }, [minDisplayTime, enabledInDev]);

  // Hide splash screen when app is ready
  const hideSplashScreen = useCallback(() => {
    console.log('[useSplashScreen] Manual hide triggered');
    setIsVisible(false);
    setIsAppReady(true);
  }, []);

  return {
    isVisible,
    isAppReady,
    hideSplashScreen
  };
};
