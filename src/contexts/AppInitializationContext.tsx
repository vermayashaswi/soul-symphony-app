import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface AppInitializationState {
  // Authentication state
  session: Session | null;
  user: User | null;
  isAuthLoading: boolean;
  
  // Onboarding state
  onboardingComplete: boolean | null;
  isOnboardingLoading: boolean;
  
  // Overall initialization state
  isInitialized: boolean;
  initializationError: string | null;
  
  // App state
  isNativeApp: boolean;
}

interface AppInitializationContextType extends AppInitializationState {
  // Actions
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  refreshState: () => Promise<void>;
}

const AppInitializationContext = createContext<AppInitializationContextType | undefined>(undefined);

const ONBOARDING_STORAGE_KEY = 'soulo-onboarding-complete';
const ONBOARDING_CACHE_KEY = 'soulo-onboarding-cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface OnboardingCache {
  value: boolean;
  timestamp: number;
  userId: string;
}

export const AppInitializationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppInitializationState>({
    session: null,
    user: null,
    isAuthLoading: true,
    onboardingComplete: null,
    isOnboardingLoading: true,
    isInitialized: false,
    initializationError: null,
    isNativeApp: nativeIntegrationService.isRunningNatively(),
  });

  // Get cached onboarding status
  const getCachedOnboardingStatus = (userId: string): boolean | null => {
    try {
      const cached = localStorage.getItem(ONBOARDING_CACHE_KEY);
      if (!cached) return null;
      
      const cacheData: OnboardingCache = JSON.parse(cached);
      const isExpired = Date.now() - cacheData.timestamp > CACHE_DURATION;
      const isWrongUser = cacheData.userId !== userId;
      
      if (isExpired || isWrongUser) {
        localStorage.removeItem(ONBOARDING_CACHE_KEY);
        return null;
      }
      
      return cacheData.value;
    } catch (error) {
      console.warn('[AppInitialization] Error reading onboarding cache:', error);
      return null;
    }
  };

  // Cache onboarding status
  const setCachedOnboardingStatus = (userId: string, value: boolean) => {
    try {
      const cacheData: OnboardingCache = {
        value,
        timestamp: Date.now(),
        userId
      };
      localStorage.setItem(ONBOARDING_CACHE_KEY, JSON.stringify(cacheData));
      localStorage.setItem(ONBOARDING_STORAGE_KEY, value.toString());
    } catch (error) {
      console.warn('[AppInitialization] Error caching onboarding status:', error);
    }
  };

  // Check onboarding status from database
  const checkOnboardingFromDatabase = async (user: User): Promise<boolean> => {
    try {
      console.log('[AppInitialization] Checking onboarding status from database for user:', user.id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('[AppInitialization] Error fetching onboarding status:', error);
        // Fallback to localStorage
        const localStatus = localStorage.getItem(ONBOARDING_STORAGE_KEY);
        return localStatus === 'true';
      }

      const isComplete = data?.onboarding_completed || false;
      console.log('[AppInitialization] Database onboarding status:', isComplete);
      
      // Cache the result
      setCachedOnboardingStatus(user.id, isComplete);
      
      return isComplete;
    } catch (error) {
      console.error('[AppInitialization] Error checking onboarding status:', error);
      // Fallback to localStorage
      const localStatus = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      return localStatus === 'true';
    }
  };

  // Initialize authentication and onboarding state
  const initializeApp = async () => {
    try {
      console.log('[AppInitialization] Starting app initialization...');
      
      // Get initial session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[AppInitialization] Session error:', error);
        setState(prev => ({
          ...prev,
          session: null,
          user: null,
          isAuthLoading: false,
          onboardingComplete: false,
          isOnboardingLoading: false,
          isInitialized: true,
          initializationError: error.message
        }));
        return;
      }

      console.log('[AppInitialization] Session check result:', {
        hasSession: !!session,
        userId: session?.user?.id
      });

      if (session?.user) {
        // Check cached onboarding status first
        let onboardingStatus = getCachedOnboardingStatus(session.user.id);
        
        if (onboardingStatus === null) {
          // No cache, check database
          setState(prev => ({
            ...prev,
            session,
            user: session.user,
            isAuthLoading: false,
            isOnboardingLoading: true
          }));
          
          onboardingStatus = await checkOnboardingFromDatabase(session.user);
        } else {
          console.log('[AppInitialization] Using cached onboarding status:', onboardingStatus);
        }

        setState(prev => ({
          ...prev,
          session,
          user: session.user,
          isAuthLoading: false,
          onboardingComplete: onboardingStatus,
          isOnboardingLoading: false,
          isInitialized: true
        }));
      } else {
        // No session
        setState(prev => ({
          ...prev,
          session: null,
          user: null,
          isAuthLoading: false,
          onboardingComplete: false,
          isOnboardingLoading: false,
          isInitialized: true
        }));
      }

      console.log('[AppInitialization] App initialization complete');
    } catch (error: any) {
      console.error('[AppInitialization] Initialization error:', error);
      setState(prev => ({
        ...prev,
        isAuthLoading: false,
        isOnboardingLoading: false,
        isInitialized: true,
        initializationError: error.message
      }));
    }
  };

  // Complete onboarding
  const completeOnboarding = async () => {
    try {
      console.log('[AppInitialization] Completing onboarding...');
      
      // Update local state immediately
      setState(prev => ({
        ...prev,
        onboardingComplete: true
      }));

      // Update localStorage
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');

      // Update database if user is authenticated
      if (state.user) {
        setCachedOnboardingStatus(state.user.id, true);
        
        const { error } = await supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', state.user.id);

        if (error) {
          console.error('[AppInitialization] Error updating onboarding status in database:', error);
          // Don't revert local state - onboarding is still complete locally
        } else {
          console.log('[AppInitialization] Onboarding status updated in database');
        }
      }
    } catch (error) {
      console.error('[AppInitialization] Error completing onboarding:', error);
    }
  };

  // Reset onboarding
  const resetOnboarding = async () => {
    try {
      console.log('[AppInitialization] Resetting onboarding...');
      
      // Update local state
      setState(prev => ({
        ...prev,
        onboardingComplete: false
      }));

      // Clear localStorage
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'false');
      localStorage.removeItem(ONBOARDING_CACHE_KEY);

      // Update database if user is authenticated
      if (state.user) {
        const { error } = await supabase
          .from('profiles')
          .update({ onboarding_completed: false })
          .eq('id', state.user.id);

        if (error) {
          console.error('[AppInitialization] Error resetting onboarding status in database:', error);
        } else {
          console.log('[AppInitialization] Onboarding status reset in database');
        }
      }
    } catch (error) {
      console.error('[AppInitialization] Error resetting onboarding:', error);
    }
  };

  // Refresh state
  const refreshState = async () => {
    console.log('[AppInitialization] Refreshing state...');
    setState(prev => ({
      ...prev,
      isAuthLoading: true,
      isOnboardingLoading: true,
      isInitialized: false
    }));
    await initializeApp();
  };

  // Setup auth listener
  useEffect(() => {
    console.log('[AppInitialization] Setting up auth listener...');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AppInitialization] Auth state changed:', event, {
          hasSession: !!session,
          userId: session?.user?.id
        });

        if (event === 'SIGNED_OUT') {
          setState(prev => ({
            ...prev,
            session: null,
            user: null,
            onboardingComplete: false,
            isInitialized: true
          }));
          
          // Clear cache
          localStorage.removeItem(ONBOARDING_CACHE_KEY);
          localStorage.setItem(ONBOARDING_STORAGE_KEY, 'false');
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            setState(prev => ({
              ...prev,
              session,
              user: session.user,
              isAuthLoading: false,
              isOnboardingLoading: true
            }));

            // Check onboarding status
            const onboardingStatus = await checkOnboardingFromDatabase(session.user);
            setState(prev => ({
              ...prev,
              onboardingComplete: onboardingStatus,
              isOnboardingLoading: false,
              isInitialized: true
            }));
          }
        }
      }
    );

    // Initialize app
    initializeApp();

    return () => subscription.unsubscribe();
  }, []);

  const contextValue: AppInitializationContextType = {
    ...state,
    completeOnboarding,
    resetOnboarding,
    refreshState
  };

  return (
    <AppInitializationContext.Provider value={contextValue}>
      {children}
    </AppInitializationContext.Provider>
  );
};

export const useAppInitialization = () => {
  const context = useContext(AppInitializationContext);
  if (context === undefined) {
    throw new Error('useAppInitialization must be used within an AppInitializationProvider');
  }
  return context;
};