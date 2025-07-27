/**
 * Enhanced Native App Initialization Hook
 * Replaces complex initialization with streamlined, reliable approach
 */

import { useEffect, useState, useCallback } from 'react';
import { simpleNativeInitService } from '@/services/simpleNativeInitService';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { resolveNativeRoute } from '@/utils/nativeRouteResolver';
import { useLocation, useNavigate } from 'react-router-dom';

interface NativeAppInitState {
  isInitialized: boolean;
  isInitializing: boolean;
  isNativeApp: boolean;
  hasError: boolean;
  error: string | null;
  initDuration?: number;
  shouldShowLoading: boolean;
}

export const useNativeAppInitialization = () => {
  const [state, setState] = useState<NativeAppInitState>({
    isInitialized: false,
    isInitializing: false,
    isNativeApp: false,
    hasError: false,
    error: null,
    shouldShowLoading: true
  });

  const location = useLocation();
  const navigate = useNavigate();

  const handleInitialization = useCallback(async () => {
    if (state.isInitialized || state.isInitializing) {
      return;
    }

    console.log('[NativeAppInit] Starting enhanced initialization...');
    
    setState(prev => ({
      ...prev,
      isInitializing: true,
      hasError: false,
      error: null
    }));

    try {
      // Step 1: Initialize core services
      const success = await simpleNativeInitService.initialize();
      
      if (!success) {
        throw new Error('Core initialization failed');
      }

      const isNative = nativeIntegrationService.isRunningNatively();
      
      // Step 2: Handle native app routing
      if (isNative) {
        const routeInfo = resolveNativeRoute(location.pathname);
        
        if (routeInfo.shouldRedirect && routeInfo.redirectTo) {
          console.log('[NativeAppInit] Redirecting to native app route:', routeInfo.redirectTo);
          navigate(routeInfo.redirectTo, { replace: true });
        }
      }

      // Step 3: Complete initialization
      const initState = simpleNativeInitService.getInitState();
      
      setState(prev => ({
        ...prev,
        isInitialized: true,
        isInitializing: false,
        isNativeApp: isNative,
        initDuration: initState.initDuration,
        shouldShowLoading: false
      }));

      console.log('[NativeAppInit] Initialization completed successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      
      setState(prev => ({
        ...prev,
        isInitialized: false,
        isInitializing: false,
        hasError: true,
        error: errorMessage,
        shouldShowLoading: false
      }));

      console.error('[NativeAppInit] Initialization failed:', errorMessage);
    }
  }, [state.isInitialized, state.isInitializing, location.pathname, navigate]);

  const retry = useCallback(() => {
    console.log('[NativeAppInit] Retrying initialization...');
    simpleNativeInitService.reset();
    setState({
      isInitialized: false,
      isInitializing: false,
      isNativeApp: false,
      hasError: false,
      error: null,
      shouldShowLoading: true
    });
  }, []);

  useEffect(() => {
    handleInitialization();
  }, [handleInitialization]);

  return {
    ...state,
    retry,
    reset: retry
  };
};