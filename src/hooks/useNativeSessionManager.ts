import { useState, useEffect, useCallback, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface NativeSessionState {
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

/**
 * Simplified session manager specifically optimized for native apps
 * Resolves race conditions by using a single source of truth with debounced updates
 */
export const useNativeSessionManager = () => {
  const [state, setState] = useState<NativeSessionState>({
    session: null,
    isLoading: true,
    isInitialized: false,
    error: null
  });

  const isNative = nativeIntegrationService.isRunningNatively();
  const initializeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionCheckRef = useRef<Promise<Session | null> | null>(null);
  const mountedRef = useRef(true);

  // Debounced session validation to prevent race conditions
  const validateSession = useCallback(async (): Promise<Session | null> => {
    // Prevent multiple simultaneous session checks
    if (sessionCheckRef.current) {
      console.log('[NativeSessionManager] Session check already in progress, waiting...');
      return sessionCheckRef.current;
    }

    const sessionCheckPromise = (async (): Promise<Session | null> => {
      try {
        console.log('[NativeSessionManager] Starting session validation...');

        // For native apps, try localStorage first for immediate response
        if (isNative) {
          try {
            const storedSession = localStorage.getItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
            if (storedSession) {
              const sessionData = JSON.parse(storedSession);
              
              // Validate session structure and expiry
              if (sessionData?.access_token && sessionData?.expires_at && sessionData?.user) {
                const now = Date.now() / 1000;
                if (sessionData.expires_at > now + 60) { // Add 60s buffer
                  console.log('[NativeSessionManager] Valid stored session found');
                  return sessionData as Session;
                }
              }
            }
          } catch (error) {
            console.warn('[NativeSessionManager] Error reading stored session:', error);
          }
        }

        // Fallback to Supabase session check
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[NativeSessionManager] Session check error:', error);
          throw error;
        }

        console.log('[NativeSessionManager] Session validation complete:', {
          hasSession: !!session,
          userId: session?.user?.id
        });

        return session;
      } catch (error) {
        console.error('[NativeSessionManager] Session validation failed:', error);
        throw error;
      } finally {
        sessionCheckRef.current = null;
      }
    })();

    sessionCheckRef.current = sessionCheckPromise;
    return sessionCheckPromise;
  }, [isNative]);

  // Initialize session with timeout for native apps
  const initializeSession = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      console.log('[NativeSessionManager] Initializing session...');
      
      // For native apps, add a small delay to let the WebView stabilize
      if (isNative) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const session = await validateSession();
      
      if (!mountedRef.current) return;

      setState({
        session,
        isLoading: false,
        isInitialized: true,
        error: null
      });

    } catch (error) {
      console.error('[NativeSessionManager] Initialization failed:', error);
      
      if (!mountedRef.current) return;

      setState({
        session: null,
        isLoading: false,
        isInitialized: true,
        error: error instanceof Error ? error.message : 'Session initialization failed'
      });
    }
  }, [validateSession, isNative]);

  // Set up auth state listener with simplified logic
  useEffect(() => {
    console.log('[NativeSessionManager] Setting up auth state listener...');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[NativeSessionManager] Auth state change:', event, !!session);
        
        if (!mountedRef.current) return;

        // Handle auth events immediately for better UX
        if (event === 'SIGNED_OUT') {
          setState({
            session: null,
            isLoading: false,
            isInitialized: true,
            error: null
          });
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setState({
            session,
            isLoading: false,
            isInitialized: true,
            error: null
          });
        }
      }
    );

    // Initial session check with timeout for native apps
    if (isNative) {
      initializeTimeoutRef.current = setTimeout(() => {
        console.log('[NativeSessionManager] Native app initialization timeout, proceeding...');
        if (mountedRef.current && state.isLoading) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            isInitialized: true
          }));
        }
      }, 5000); // 5 second timeout for native apps
    }

    initializeSession();

    return () => {
      subscription.unsubscribe();
      if (initializeTimeoutRef.current) {
        clearTimeout(initializeTimeoutRef.current);
      }
    };
  }, [initializeSession, isNative]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshSession = useCallback(async () => {
    if (!mountedRef.current) return null;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const session = await validateSession();
      
      if (!mountedRef.current) return null;
      
      setState({
        session,
        isLoading: false,
        isInitialized: true,
        error: null
      });
      
      return session;
    } catch (error) {
      if (!mountedRef.current) return null;
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Refresh failed'
      }));
      
      return null;
    }
  }, [validateSession]);

  return {
    ...state,
    refreshSession,
    isNative
  };
};