import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAppInitialization } from '@/hooks/useAppInitialization';
import { useAuth } from '@/contexts/AuthContext';

interface InitializationPhase {
  fonts: boolean;
  auth: boolean;
  appServices: boolean;
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
  const [phases, setPhases] = useState<InitializationPhase>({
    fonts: false,
    auth: false,
    appServices: false,
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
  const { user, isLoading: authLoading } = useAuth();
  useEffect(() => {
    if (!authLoading) {
      markPhaseComplete('auth');
      setCurrentPhase('Loading app services...');
    }
  }, [authLoading]);

  // Mark context providers as ready after a brief delay to ensure all providers are mounted
  useEffect(() => {
    if (phases.fonts && phases.auth && phases.appServices) {
      const timer = setTimeout(() => {
        markPhaseComplete('contextProviders');
        setCurrentPhase('Ready!');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [phases.fonts, phases.auth, phases.appServices]);

  const markPhaseComplete = (phase: keyof InitializationPhase) => {
    setPhases(prev => ({ ...prev, [phase]: true }));
  };

  const resetInitialization = () => {
    setPhases({
      fonts: false,
      auth: false,
      appServices: false,
      contextProviders: false
    });
    setCurrentPhase('Initializing fonts...');
    setError(null);
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