
import { useEffect, useState, useRef } from 'react';
import { detectTWAEnvironment } from '@/utils/twaDetection';
import { useAuth } from '@/contexts/AuthContext';
import { useTWAAutoRefresh } from './useTWAAutoRefresh';

interface TWAInitializationState {
  isInitialized: boolean;
  isLoading: boolean;
  initializationComplete: boolean;
  hasTimedOut: boolean;
}

export const useTWAInitialization = () => {
  const [initState, setInitState] = useState<TWAInitializationState>({
    isInitialized: false,
    isLoading: true,
    initializationComplete: false,
    hasTimedOut: false
  });
  
  const { user, isLoading: authLoading } = useAuth();
  const twaEnv = detectTWAEnvironment();
  const initializationStartedRef = useRef(false);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authStabilizedRef = useRef(false);
  
  const { 
    startStuckDetection, 
    stopStuckDetection, 
    resetRefreshState,
    isTWAEnvironment 
  } = useTWAAutoRefresh();

  useEffect(() => {
    // Only run initialization once and only in TWA environment
    if (initializationStartedRef.current || (!twaEnv.isTWA && !twaEnv.isStandalone)) {
      // For non-TWA environments, complete initialization immediately
      if (!twaEnv.isTWA && !twaEnv.isStandalone && !initState.initializationComplete) {
        setInitState(prev => ({
          ...prev,
          isInitialized: true,
          isLoading: false,
          initializationComplete: true
        }));
      }
      return;
    }
    
    initializationStartedRef.current = true;
    console.log('[TWA Init] Starting TWA initialization process with auto-refresh monitoring', {
      isTWA: twaEnv.isTWA,
      isStandalone: twaEnv.isStandalone,
      authLoading,
      hasUser: !!user
    });

    // Start auto-refresh monitoring
    startStuckDetection();

    // Set a timeout to prevent infinite loading
    initTimeoutRef.current = setTimeout(() => {
      console.log('[TWA Init] Initialization timeout reached, forcing completion');
      setInitState(prev => ({
        ...prev,
        isInitialized: true,
        isLoading: false,
        initializationComplete: true,
        hasTimedOut: true
      }));
      
      // Stop auto-refresh monitoring since we're completing initialization
      stopStuckDetection();
    }, 8000);

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      stopStuckDetection();
    };
  }, [twaEnv.isTWA, twaEnv.isStandalone, startStuckDetection, stopStuckDetection]);

  // Handle auth stabilization
  useEffect(() => {
    if (!twaEnv.isTWA && !twaEnv.isStandalone) return;
    
    // Auth is considered stabilized when loading stops
    if (!authLoading && !authStabilizedRef.current) {
      authStabilizedRef.current = true;
      console.log('[TWA Init] Auth has stabilized, completing initialization');
      
      // Clear any existing timeout
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      
      // Add a small delay for TWA stability
      setTimeout(() => {
        setInitState(prev => ({
          ...prev,
          isInitialized: true,
          isLoading: false,
          initializationComplete: true
        }));
        
        // Reset auto-refresh state since initialization completed successfully
        resetRefreshState();
      }, 1000);
    }
  }, [authLoading, twaEnv.isTWA, twaEnv.isStandalone, resetRefreshState]);

  // Reset initialization state when auth state changes significantly
  useEffect(() => {
    if (!twaEnv.isTWA && !twaEnv.isStandalone) return;
    
    // If user changes (login/logout), reset auth stabilization
    authStabilizedRef.current = false;
  }, [user?.id, twaEnv.isTWA, twaEnv.isStandalone]);

  return {
    ...initState,
    isTWAEnvironment: twaEnv.isTWA || twaEnv.isStandalone
  };
};
