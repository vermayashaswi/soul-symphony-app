import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { authStateManager } from '@/services/authStateManager';

interface NativeAuthState {
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

/**
 * Specialized hook for native app authentication initialization
 * Handles the specific auth flow issues in Capacitor environment
 */
export const useNativeAuthInitialization = () => {
  const [state, setState] = useState<NativeAuthState>({
    session: null,
    isLoading: true,
    isInitialized: false,
    error: null
  });

  const isNative = nativeIntegrationService.isRunningNatively();

  useEffect(() => {
    if (!isNative) {
      // Not native, skip this specialized initialization
      setState(prev => ({ ...prev, isLoading: false, isInitialized: true }));
      return;
    }

    let mounted = true;
    let authSubscription: any = null;

    const initializeNativeAuth = async () => {
      try {
        console.log('[NativeAuth] Starting native authentication initialization...');

        // Set up auth state listener first
        authSubscription = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (!mounted) return;

            console.log('[NativeAuth] Auth state changed:', { event, hasSession: !!session });

            if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
              setState(prev => ({
                ...prev,
                session,
                isLoading: false,
                isInitialized: true,
                error: null
              }));
            } else if (event === 'SIGNED_IN' && session) {
              setState(prev => ({
                ...prev,
                session,
                isLoading: false,
                isInitialized: true,
                error: null
              }));
            }
          }
        );

        // Wait a moment for auth listener to be set up
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check for existing session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[NativeAuth] Session check error:', error);
          
          // Handle common native auth errors
          if (error.message?.includes('refresh_token_not_found')) {
            console.log('[NativeAuth] Clearing invalid auth state');
            await supabase.auth.signOut();
            if (mounted) {
              setState({
                session: null,
                isLoading: false,
                isInitialized: true,
                error: null
              });
            }
            return;
          }
          
          if (mounted) {
            setState({
              session: null,
              isLoading: false,
              isInitialized: true,
              error: error.message
            });
          }
          return;
        }

        console.log('[NativeAuth] Initial session check complete:', {
          hasSession: !!session,
          userId: session?.user?.id
        });

        if (mounted) {
          setState({
            session,
            isLoading: false,
            isInitialized: true,
            error: null
          });
        }

        // Notify auth state manager if we have a session
        if (session) {
          authStateManager.handleAuthSuccess();
        }

      } catch (error) {
        console.error('[NativeAuth] Initialization failed:', error);
        if (mounted) {
          setState({
            session: null,
            isLoading: false,
            isInitialized: true,
            error: error instanceof Error ? error.message : 'Authentication initialization failed'
          });
        }
      }
    };

    initializeNativeAuth();

    return () => {
      mounted = false;
      if (authSubscription?.unsubscribe) {
        authSubscription.unsubscribe();
      }
    };
  }, [isNative]);

  return {
    ...state,
    isNative
  };
};