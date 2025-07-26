import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionValidation } from '@/hooks/useSessionValidation';
import { useCapacitorInitialization } from '@/hooks/useCapacitorInitialization';
import { useOnboarding } from '@/hooks/use-onboarding';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { useLocation } from 'react-router-dom';
import { useUnifiedInitialization } from '@/hooks/useUnifiedInitialization';

interface InitializationState {
  phases: {
    auth: 'loading' | 'ready' | 'timeout' | 'error';
    session: 'loading' | 'valid' | 'invalid' | 'timeout';
    capacitor: 'loading' | 'ready' | 'timeout' | 'skipped';
    onboarding: 'loading' | 'complete' | 'incomplete' | 'error';
    navigation: 'loading' | 'ready' | 'error';
  };
  isComplete: boolean;
  hasErrors: boolean;
  timeouts: number;
  isNativeApp: boolean;
}

export const useDebugInitialization = () => {
  const [state, setState] = useState<InitializationState>({
    phases: {
      auth: 'loading',
      session: 'loading', 
      capacitor: 'loading',
      onboarding: 'loading',
      navigation: 'loading'
    },
    isComplete: false,
    hasErrors: false,
    timeouts: 0,
    isNativeApp: nativeIntegrationService.isRunningNatively()
  });

  const { user, isLoading: authLoading } = useAuth();
  const { session, isValid: sessionValid, isLoading: sessionLoading } = useSessionValidation();
  const { 
    isLoading: capacitorLoading, 
    initializationComplete: capacitorComplete,
    hasTimedOut: capacitorTimeout,
    isNativeEnvironment 
  } = useCapacitorInitialization();
  const { onboardingComplete, loading: onboardingLoading } = useOnboarding();
  const location = useLocation();
  
  // Integrate with unified initialization manager
  const unifiedInit = useUnifiedInitialization();

  const initStartTime = useRef(Date.now());

  // Track all states and log changes
  useEffect(() => {
    const newState: InitializationState = {
      phases: {
        auth: authLoading ? 'loading' : (user ? 'ready' : 'error'),
        session: sessionLoading ? 'loading' : (sessionValid ? 'valid' : 'invalid'),
        capacitor: isNativeEnvironment ? 
          (capacitorLoading ? 'loading' : (capacitorComplete ? 'ready' : (capacitorTimeout ? 'timeout' : 'loading'))) : 
          'skipped',
        onboarding: onboardingLoading ? 'loading' : 
          (onboardingComplete === true ? 'complete' : 
           (onboardingComplete === false ? 'incomplete' : 'loading')),
        navigation: 'ready'
      },
      isComplete: false,
      hasErrors: false,
      timeouts: capacitorTimeout ? 1 : 0,
      isNativeApp: isNativeEnvironment
    };

    // Determine if initialization is complete
    const authReady = newState.phases.auth === 'ready' || newState.phases.auth === 'error';
    const sessionReady = newState.phases.session === 'valid' || newState.phases.session === 'invalid';
    const capacitorReady = newState.phases.capacitor === 'ready' || newState.phases.capacitor === 'skipped' || newState.phases.capacitor === 'timeout';
    const onboardingReady = newState.phases.onboarding !== 'loading';

    newState.isComplete = authReady && sessionReady && capacitorReady && onboardingReady;
    newState.hasErrors = Object.values(newState.phases).includes('error' as any) || newState.timeouts > 0;

    const elapsedTime = Date.now() - initStartTime.current;

    console.log(`[DebugInit] Initialization state update (${elapsedTime}ms):`, {
      phases: newState.phases,
      isComplete: newState.isComplete,
      hasErrors: newState.hasErrors,
      location: location.pathname,
      user: !!user,
      session: !!session,
      nativeApp: newState.isNativeApp
    });

    setState(newState);
  }, [
    authLoading, user, 
    sessionLoading, sessionValid, session,
    capacitorLoading, capacitorComplete, capacitorTimeout, isNativeEnvironment,
    onboardingLoading, onboardingComplete,
    location.pathname
  ]);

  return state;
};