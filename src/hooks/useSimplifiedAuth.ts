import { useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import * as authService from '@/services/authService';
import { authStateSynchronizer } from '@/services/authStateSynchronizer';

interface SimplifiedAuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
}

export const useSimplifiedAuth = () => {
  const [state, setState] = useState<SimplifiedAuthState>({
    session: null,
    user: null,
    isLoading: true,
    isInitialized: false
  });

  const updateAuthState = useCallback((session: Session | null) => {
    setState({
      session,
      user: session?.user ?? null,
      isLoading: false,
      isInitialized: true
    });

    // Background profile sync - non-blocking
    if (session?.user) {
      setTimeout(() => {
        authStateSynchronizer.ensureProfileExists(session.user.id, session.user.email)
          .catch(error => console.warn('[useSimplifiedAuth] Profile sync failed:', error));
      }, 100);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      await authService.signInWithGoogle();
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      await authService.signInWithApple();
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      await authService.signOut();
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const session = await authService.refreshSession();
    updateAuthState(session);
  }, [updateAuthState]);

  useEffect(() => {
    // Set up auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[useSimplifiedAuth] Auth state changed: ${event}`, {
        hasUser: !!session?.user,
        userId: session?.user?.id
      });
      updateAuthState(session);
    });

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[useSimplifiedAuth] Initial session:', !!session?.user);
      updateAuthState(session);
    });

    return () => subscription.unsubscribe();
  }, [updateAuthState]);

  return {
    ...state,
    signInWithGoogle,
    signInWithApple,
    signOut,
    refreshSession
  };
};