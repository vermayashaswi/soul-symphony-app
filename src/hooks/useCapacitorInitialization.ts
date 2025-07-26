import { useEffect, useState, useRef } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { useAuth } from '@/contexts/AuthContext';

interface CapacitorInitializationState {
  isInitialized: boolean;
  isLoading: boolean;
  initializationComplete: boolean;
  hasTimedOut: boolean;
}

export const useCapacitorInitialization = () => {
  const [initState, setInitState] = useState<CapacitorInitializationState>({
    isInitialized: false,
    isLoading: true,
    initializationComplete: false,
    hasTimedOut: false
  });
  
  const { user, isLoading: authLoading } = useAuth();
  const initializationStartedRef = useRef(false);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authStabilizedRef = useRef(false);

  useEffect(() => {
    // Only run initialization once and only in native environment
    if (initializationStartedRef.current || !nativeIntegrationService.isRunningNatively()) {
      // For non-native environments, complete initialization immediately
      if (!nativeIntegrationService.isRunningNatively() && !initState.initializationComplete) {
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
    console.log('[Capacitor Init] Starting Capacitor initialization process', {
      isNative: nativeIntegrationService.isRunningNatively(),
      authLoading,
      hasUser: !!user
    });

    // Set a timeout to prevent infinite loading
    initTimeoutRef.current = setTimeout(() => {
      console.log('[Capacitor Init] Initialization timeout reached, forcing completion');
      setInitState(prev => ({
        ...prev,
        isInitialized: true,
        isLoading: false,
        initializationComplete: true,
        hasTimedOut: true
      }));
    }, 8000);

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
    };
  }, [nativeIntegrationService.isRunningNatively()]);

  // Handle auth stabilization
  useEffect(() => {
    if (!nativeIntegrationService.isRunningNatively()) return;
    
    // Auth is considered stabilized when loading stops
    if (!authLoading && !authStabilizedRef.current) {
      authStabilizedRef.current = true;
      console.log('[Capacitor Init] Auth has stabilized, completing initialization');
      
      // Clear any existing timeout
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      
      // Add a small delay for Capacitor stability
      setTimeout(() => {
        setInitState(prev => ({
          ...prev,
          isInitialized: true,
          isLoading: false,
          initializationComplete: true
        }));
      }, 1000);
    }
  }, [authLoading]);

  // Reset initialization state when auth state changes significantly
  useEffect(() => {
    if (!nativeIntegrationService.isRunningNatively()) return;
    
    // If user changes (login/logout), reset auth stabilization
    authStabilizedRef.current = false;
  }, [user?.id]);

  return {
    ...initState,
    isNativeEnvironment: nativeIntegrationService.isRunningNatively()
  };
};