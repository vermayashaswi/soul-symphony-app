import { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface OptimizedAuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasValidSession: boolean;
}

/**
 * Optimized auth hook that minimizes database queries and uses localStorage for faster checks
 * Specifically designed to reduce mobile navigation dependency on database
 */
export function useOptimizedAuth() {
  const [authState, setAuthState] = useState<OptimizedAuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    hasValidSession: false
  });

  // Memoized auth check from localStorage for immediate UI responsiveness
  const quickAuthCheck = useMemo(() => {
    const hasStoredSession = localStorage.getItem('sb-access-token') || 
                            localStorage.getItem('sb-refresh-token') ||
                            localStorage.getItem('supabase.auth.token');
    
    return {
      hasStoredAuth: !!hasStoredSession,
      timestamp: Date.now()
    };
  }, []);

  // Optimized session validation - prioritizes localStorage for mobile navigation
  const validateSession = useCallback(async () => {
    try {
      // Quick check for mobile navigation responsiveness
      if (nativeIntegrationService.isRunningNatively() && quickAuthCheck.hasStoredAuth) {
        // For native apps with stored tokens, assume valid until proven otherwise
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: true,
          hasValidSession: true,
          isLoading: false
        }));
      }

      // Async validation
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.warn('[OptimizedAuth] Session validation error:', error);
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          hasValidSession: false
        });
        return;
      }

      const isValid = !!session?.user && !!session?.access_token;
      
      setAuthState({
        user: session?.user || null,
        isAuthenticated: isValid,
        isLoading: false,
        hasValidSession: isValid
      });

    } catch (error) {
      console.error('[OptimizedAuth] Session validation failed:', error);
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        hasValidSession: false
      });
    }
  }, [quickAuthCheck.hasStoredAuth]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      // Immediate update for mobile responsiveness
      if (quickAuthCheck.hasStoredAuth) {
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: true,
          isLoading: false
        }));
      }

      // Then validate properly
      if (mounted) {
        await validateSession();
      }
    };

    initializeAuth();

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('[OptimizedAuth] Auth state change:', event);
        
        const isValid = !!session?.user && !!session?.access_token;
        
        setAuthState({
          user: session?.user || null,
          isAuthenticated: isValid,
          isLoading: false,
          hasValidSession: isValid
        });
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [validateSession]);

  return {
    ...authState,
    quickAuthCheck,
    refreshAuth: validateSession
  };
}