
import { useEffect, useState, useRef } from 'react';
import { detectTWAEnvironment } from '@/utils/twaDetection';
import { useAuth } from '@/contexts/AuthContext';

interface TWAInitializationState {
  isInitialized: boolean;
  isLoading: boolean;
  initializationComplete: boolean;
}

export const useTWAInitialization = () => {
  const [initState, setInitState] = useState<TWAInitializationState>({
    isInitialized: false,
    isLoading: true,
    initializationComplete: false
  });
  
  const { user, isLoading: authLoading } = useAuth();
  const twaEnv = detectTWAEnvironment();
  const initializationStartedRef = useRef(false);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only run initialization once
    if (initializationStartedRef.current) {
      return;
    }
    
    initializationStartedRef.current = true;
    console.log('[TWA Init] Starting initialization process', {
      isTWA: twaEnv.isTWA || twaEnv.isStandalone,
      authLoading,
      hasUser: !!user
    });

    const initializeApp = () => {
      // Set a maximum timeout for initialization to prevent infinite loading
      initTimeoutRef.current = setTimeout(() => {
        console.log('[TWA Init] Force completing initialization after timeout');
        setInitState({
          isInitialized: true,
          isLoading: false,
          initializationComplete: true
        });
      }, 5000); // 5 second maximum

      // Wait for auth to stabilize
      if (!authLoading) {
        console.log('[TWA Init] Auth loading complete, finalizing initialization');
        
        // Clear timeout since we're completing normally
        if (initTimeoutRef.current) {
          clearTimeout(initTimeoutRef.current);
          initTimeoutRef.current = null;
        }
        
        setInitState({
          isInitialized: true,
          isLoading: false,
          initializationComplete: true
        });
      }
    };

    // Small delay to ensure all contexts are ready
    const delay = (twaEnv.isTWA || twaEnv.isStandalone) ? 1000 : 500;
    setTimeout(initializeApp, delay);

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [authLoading, user, twaEnv.isTWA, twaEnv.isStandalone]);

  return {
    ...initState,
    isTWAEnvironment: twaEnv.isTWA || twaEnv.isStandalone
  };
};
