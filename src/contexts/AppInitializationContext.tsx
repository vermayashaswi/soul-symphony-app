import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppInitialization } from '@/hooks/useAppInitialization';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useSessionValidation } from '@/hooks/useSessionValidation';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { supabase } from '@/integrations/supabase/client';

interface InitializationPhase {
  fonts: boolean;
  auth: boolean;
  appServices: boolean;
  navigation: boolean;
  contextProviders: boolean;
}

interface AppInitializationState {
  isAppReady: boolean;
  phases: InitializationPhase;
  progress: number;
  currentPhase: string;
  error: string | null;
}

interface AppInitializationContextType extends AppInitializationState {
  markPhaseComplete: (phase: keyof InitializationPhase) => void;
  resetInitialization: () => void;
}

const AppInitializationContext = createContext<AppInitializationContextType | undefined>(undefined);

export function AppInitializationProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { onboardingComplete, checkOnboardingStatus } = useOnboarding();
  const { session: validatedSession, isValid: hasValidSession } = useSessionValidation();
  const navigationHandledRef = useRef(false);
  const isInitializedRef = useRef(false);

  const [phases, setPhases] = useState<InitializationPhase>({
    fonts: false,
    auth: false,
    appServices: false,
    navigation: false,
    contextProviders: false
  });

  const [currentPhase, setCurrentPhase] = useState<string>('Initializing fonts...');
  const [error, setError] = useState<string | null>(null);

  // Monitor font loading
  useEffect(() => {
    const checkFonts = () => {
      if ((window as any).__SOULO_FONTS_READY__) {
        markPhaseComplete('fonts');
        setCurrentPhase('Loading authentication...');
      }
    };

    // Check immediately in case fonts are already loaded
    checkFonts();

    // Listen for font ready event
    const handleFontsReady = () => {
      markPhaseComplete('fonts');
      setCurrentPhase('Loading authentication...');
    };

    window.addEventListener('fontsReady', handleFontsReady);
    
    // Fallback timeout to prevent hanging
    const fontTimeout = setTimeout(() => {
      if (!phases.fonts) {
        console.warn('[AppInit] Font loading timeout, proceeding anyway');
        markPhaseComplete('fonts');
        setCurrentPhase('Loading authentication...');
      }
    }, 3000);

    return () => {
      window.removeEventListener('fontsReady', handleFontsReady);
      clearTimeout(fontTimeout);
    };
  }, [phases.fonts]);

  // Monitor app services initialization
  const appInit = useAppInitialization();
  useEffect(() => {
    if (appInit.isInitialized && !appInit.error) {
      markPhaseComplete('appServices');
      setCurrentPhase('Finalizing setup...');
    } else if (appInit.error) {
      setError(appInit.error);
    }
  }, [appInit.isInitialized, appInit.error]);

  // Monitor auth state
  const { isLoading: authLoading } = useAuth();
  useEffect(() => {
    if (!authLoading) {
      markPhaseComplete('auth');
      setCurrentPhase('Loading app services...');
    }
  }, [authLoading]);

  // Handle navigation logic once auth and app services are ready
  useEffect(() => {
    if (phases.fonts && phases.auth && phases.appServices && !phases.navigation && !navigationHandledRef.current) {
      setCurrentPhase('Determining navigation...');
      navigationHandledRef.current = true;
      
      const handleNavigation = async () => {
        try {
          const isNative = nativeIntegrationService.isRunningNatively();
          const urlParams = new URLSearchParams(window.location.search);
          const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
          
          // Check for OAuth callback parameters
          const hasOAuthParams = urlParams.has('access_token') || hashParams.has('access_token') ||
                                urlParams.has('code') || hashParams.has('code') ||
                                urlParams.has('error') || hashParams.has('error');
          
          console.log('[AppInit] Navigation handling - isNative:', isNative, 'hasOAuth:', hasOAuthParams, 'user:', !!user, 'path:', location.pathname);
          
          // Handle OAuth callbacks first
          if (hasOAuthParams && !location.pathname.includes('/app/auth')) {
            console.log('[AppInit] OAuth callback detected, redirecting to auth');
            navigate(`/app/auth${window.location.search}${window.location.hash}`, { replace: true });
            markPhaseComplete('navigation');
            return;
          }
          
          // Native app handling
          if (isNative) {
            console.log('[AppInit] Native app detected');
            
            // If on root or website pages, redirect to app
            if (location.pathname === '/' || !location.pathname.startsWith('/app/')) {
              if (!user && !hasValidSession) {
                console.log('[AppInit] Native app, no user, redirecting to onboarding');
                navigate('/app/onboarding', { replace: true });
              } else {
                // Check onboarding status for authenticated users
                const isComplete = await checkOnboardingStatus();
                if (!isComplete) {
                  console.log('[AppInit] Native app, onboarding incomplete, redirecting to onboarding');
                  navigate('/app/onboarding', { replace: true });
                } else {
                  console.log('[AppInit] Native app, user ready, redirecting to home');
                  navigate('/app/home', { replace: true });
                }
              }
            }
            markPhaseComplete('navigation');
            return;
          }
          
          // Web app handling
          console.log('[AppInit] Web environment');
          
          // Check for explicit app redirect parameter
          if (urlParams.has('app') && location.pathname === '/') {
            if (user) {
              const isComplete = await checkOnboardingStatus();
              if (isComplete) {
                navigate('/app/home', { replace: true });
              } else {
                navigate('/app/onboarding', { replace: true });
              }
            } else {
              navigate('/app/auth', { replace: true });
            }
            markPhaseComplete('navigation');
            return;
          }
          
          // Check for specific feature redirects
          if (urlParams.has('insights')) {
            navigate('/app/insights', { replace: true });
            markPhaseComplete('navigation');
            return;
          }
          
          // Handle tutorial status for authenticated web users on root path
          if (user && location.pathname === '/') {
            try {
              // Check onboarding completion
              const isOnboardingComplete = await checkOnboardingStatus();
              
              if (isOnboardingComplete) {
                // Check tutorial completion status
                const { data: profileData } = await supabase
                  .from('profiles')
                  .select('tutorial_completed, tutorial_step')
                  .eq('id', user.id)
                  .maybeSingle();
                
                // Ensure tutorial_completed is properly set
                if (!profileData || profileData.tutorial_completed !== 'YES') {
                  if (!profileData || profileData.tutorial_completed !== 'NO') {
                    await supabase
                      .from('profiles')
                      .upsert({ 
                        id: user.id,
                        tutorial_completed: 'NO',
                        tutorial_step: profileData?.tutorial_step || 0
                      });
                  }
                }
              }
            } catch (error) {
              console.error('[AppInit] Error checking tutorial status:', error);
            }
          }
          
          // For all other cases, navigation is complete (stay on current page)
          markPhaseComplete('navigation');
          
        } catch (error) {
          console.error('[AppInit] Navigation handling error:', error);
          markPhaseComplete('navigation'); // Don't block initialization on navigation errors
        }
      };
      
      handleNavigation();
    }
  }, [phases.fonts, phases.auth, phases.appServices, phases.navigation, user, hasValidSession, location.pathname, navigate, checkOnboardingStatus]);

  // Mark context providers as ready after navigation is complete
  useEffect(() => {
    if (phases.fonts && phases.auth && phases.appServices && phases.navigation && !phases.contextProviders) {
      const timer = setTimeout(() => {
        markPhaseComplete('contextProviders');
        setCurrentPhase('Ready!');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [phases.fonts, phases.auth, phases.appServices, phases.navigation, phases.contextProviders]);

  const markPhaseComplete = (phase: keyof InitializationPhase) => {
    setPhases(prev => ({ ...prev, [phase]: true }));
  };

  const resetInitialization = () => {
    setPhases({
      fonts: false,
      auth: false,
      appServices: false,
      navigation: false,
      contextProviders: false
    });
    setCurrentPhase('Initializing fonts...');
    setError(null);
    navigationHandledRef.current = false;
    isInitializedRef.current = false;
  };

  // Calculate progress
  const completedPhases = Object.values(phases).filter(Boolean).length;
  const totalPhases = Object.keys(phases).length;
  const progress = Math.round((completedPhases / totalPhases) * 100);

  // App is ready when all phases are complete
  const isAppReady = Object.values(phases).every(Boolean) && !error;

  const value: AppInitializationContextType = {
    isAppReady,
    phases,
    progress,
    currentPhase,
    error,
    markPhaseComplete,
    resetInitialization
  };

  return (
    <AppInitializationContext.Provider value={value}>
      {children}
    </AppInitializationContext.Provider>
  );
}

export function useAppInitializationContext() {
  const context = useContext(AppInitializationContext);
  if (context === undefined) {
    throw new Error('useAppInitializationContext must be used within an AppInitializationProvider');
  }
  return context;
}