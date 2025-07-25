import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionValidation } from './useSessionValidation';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface RoutingState {
  isProcessing: boolean;
  shouldRedirect: boolean;
  targetPath: string | null;
  error: string | null;
}

export const useSimplifiedRouting = () => {
  const [state, setState] = useState<RoutingState>({
    isProcessing: true,
    shouldRedirect: false,
    targetPath: null,
    error: null
  });
  
  const { user } = useAuth();
  const { session, isValid, isLoading, timeoutReached } = useSessionValidation();
  const navigate = useNavigate();
  const location = useLocation();
  const isNative = nativeIntegrationService.isRunningNatively();

  useEffect(() => {
    // Emergency timeout to prevent infinite loading
    const emergencyTimeout = setTimeout(() => {
      console.log('[useSimplifiedRouting] Emergency timeout triggered');
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: 'Routing timeout - redirecting to safe path',
        shouldRedirect: true,
        targetPath: isNative ? '/app/home' : '/'
      }));
    }, 15000); // 15 second emergency timeout

    const processRouting = () => {
      // Don't process if session is still loading, unless timeout reached
      if (isLoading && !timeoutReached) {
        return;
      }

      const currentPath = location.pathname;
      
      console.log('[useSimplifiedRouting] Processing routing:', {
        currentPath,
        hasUser: !!user,
        hasSession: !!session,
        isValid,
        isNative,
        timeoutReached
      });

      // For native apps with valid session, always go to home unless already there
      if (isNative && (isValid || user)) {
        if (currentPath !== '/app/home' && !currentPath.startsWith('/app/')) {
          setState({
            isProcessing: false,
            shouldRedirect: true,
            targetPath: '/app/home',
            error: null
          });
          return;
        }
      }
      
      // For native apps without session, go to onboarding
      if (isNative && !user && !session) {
        if (currentPath !== '/app/onboarding') {
          setState({
            isProcessing: false,
            shouldRedirect: true,
            targetPath: '/app/onboarding',
            error: null
          });
          return;
        }
      }
      
      // For web apps, handle OAuth callbacks
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
      const hasOAuthParams = urlParams.has('access_token') || hashParams.has('access_token') ||
                            urlParams.has('code') || hashParams.has('code');
      
      if (hasOAuthParams && currentPath !== '/app/auth') {
        setState({
          isProcessing: false,
          shouldRedirect: true,
          targetPath: '/app/auth',
          error: null
        });
        return;
      }

      // Default: no redirect needed
      setState({
        isProcessing: false,
        shouldRedirect: false,
        targetPath: null,
        error: null
      });
    };

    processRouting();
    
    return () => clearTimeout(emergencyTimeout);
  }, [user, session, isValid, isLoading, timeoutReached, location.pathname, isNative]);

  // Execute redirect if needed
  useEffect(() => {
    if (state.shouldRedirect && state.targetPath) {
      console.log('[useSimplifiedRouting] Executing redirect to:', state.targetPath);
      navigate(state.targetPath, { replace: true });
    }
  }, [state.shouldRedirect, state.targetPath, navigate]);

  return state;
};