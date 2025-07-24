
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

  // Check if we're in a native Android environment
  const isNativeAndroid = (window as any).Capacitor?.isNative || 
                         navigator.userAgent.toLowerCase().includes('wv') ||
                         window.location.href.includes('capacitor://');

  useEffect(() => {
    // For native Android apps, complete initialization immediately
    if (isNativeAndroid) {
      console.log('[TWA Init] Native Android detected, completing initialization immediately');
      setInitState({
        isInitialized: true,
        isLoading: false,
        initializationComplete: true,
        hasTimedOut: false
      });
      return;
    }

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
    console.log('[TWA Init] Starting TWA initialization process', {
      isTWA: twaEnv.isTWA,
      isStandalone: twaEnv.isStandalone,
      authLoading,
      hasUser: !!user
    });

    // For TWA environments, use shorter timeout and simpler logic
    initTimeoutRef.current = setTimeout(() => {
      console.log('[TWA Init] Initialization timeout reached, forcing completion');
      setInitState(prev => ({
        ...prev,
        isInitialized: true,
        isLoading: false,
        initializationComplete: true,
        hasTimedOut: true
      }));
    }, 3000); // Reduced from 8000ms

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
    };
  }, [twaEnv.isTWA, twaEnv.isStandalone, isNativeAndroid]);

  // Handle auth stabilization for TWA (skip for native Android)
  useEffect(() => {
    if (isNativeAndroid || (!twaEnv.isTWA && !twaEnv.isStandalone)) return;
    
    // Auth is considered stabilized when loading stops
    if (!authLoading && !authStabilizedRef.current) {
      authStabilizedRef.current = true;
      console.log('[TWA Init] Auth has stabilized, completing initialization immediately');
      
      // Clear any existing timeout
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      
      // Complete initialization immediately for better performance
      setInitState(prev => ({
        ...prev,
        isInitialized: true,
        isLoading: false,
        initializationComplete: true
      }));
    }
  }, [authLoading, twaEnv.isTWA, twaEnv.isStandalone, isNativeAndroid]);

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
