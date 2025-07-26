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
  const emergencyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const isNative = nativeIntegrationService.isRunningNatively();
    
    // For non-native environments, complete initialization immediately
    if (!isNative) {
      if (!initState.initializationComplete) {
        console.log('[Capacitor Init] Non-native environment, completing immediately');
        setInitState(prev => ({
          ...prev,
          isInitialized: true,
          isLoading: false,
          initializationComplete: true
        }));
      }
      return;
    }

    // Only run initialization once for native environment
    if (initializationStartedRef.current) {
      return;
    }
    
    initializationStartedRef.current = true;
    console.log('[Capacitor Init] Starting native initialization process', {
      isNative,
      authLoading,
      hasUser: !!user
    });

    // Progressive timeout system
    // First timeout: Auth stabilization (shorter)
    initTimeoutRef.current = setTimeout(() => {
      console.log('[Capacitor Init] Auth stabilization timeout (5s), checking state');
      if (!authStabilizedRef.current && !authLoading) {
        console.log('[Capacitor Init] Force auth stabilization');
        authStabilizedRef.current = true;
      }
    }, 5000);

    // Emergency timeout: Force completion (longer) 
    emergencyTimeoutRef.current = setTimeout(() => {
      console.warn('[Capacitor Init] EMERGENCY timeout reached (12s), forcing completion');
      setInitState(prev => ({
        ...prev,
        isInitialized: true,
        isLoading: false,
        initializationComplete: true,
        hasTimedOut: true
      }));
    }, 12000);

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      if (emergencyTimeoutRef.current) {
        clearTimeout(emergencyTimeoutRef.current);
        emergencyTimeoutRef.current = null;
      }
    };
  }, []);

  // Enhanced auth stabilization with faster completion
  useEffect(() => {
    if (!nativeIntegrationService.isRunningNatively()) return;
    
    // Auth is considered stabilized when loading stops OR when we have a user
    const shouldStabilize = (!authLoading && !authStabilizedRef.current) || 
                           (!!user && !authStabilizedRef.current);
    
    if (shouldStabilize) {
      authStabilizedRef.current = true;
      console.log('[Capacitor Init] Auth stabilized', { 
        authLoading, 
        hasUser: !!user,
        reason: !authLoading ? 'loading_stopped' : 'user_available'
      });
      
      // Clear timeouts
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      if (emergencyTimeoutRef.current) {
        clearTimeout(emergencyTimeoutRef.current);
        emergencyTimeoutRef.current = null;
      }
      
      // Faster completion for better UX
      setTimeout(() => {
        setInitState(prev => ({
          ...prev,
          isInitialized: true,
          isLoading: false,
          initializationComplete: true
        }));
      }, 300); // Reduced from 1000ms to 300ms
    }
  }, [authLoading, user]);

  // Reset initialization state when auth state changes significantly
  useEffect(() => {
    if (!nativeIntegrationService.isRunningNatively()) return;
    
    // If user changes (login/logout), reset auth stabilization but only if not already complete
    if (!initState.initializationComplete) {
      authStabilizedRef.current = false;
      console.log('[Capacitor Init] User changed, resetting stabilization');
    }
  }, [user?.id, initState.initializationComplete]);

  return {
    ...initState,
    isNativeEnvironment: nativeIntegrationService.isRunningNatively()
  };
};