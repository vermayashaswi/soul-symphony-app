import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface SessionValidationState {
  session: Session | null;
  isLoading: boolean;
  isValid: boolean;
  error: string | null;
}

export const useSessionValidation = () => {
  const [state, setState] = useState<SessionValidationState>({
    session: null,
    isLoading: true,
    isValid: false,
    error: null
  });

  const isNative = nativeIntegrationService.isRunningNatively();

  const validateStoredSession = (): Session | null => {
    try {
      const storedSession = localStorage.getItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
      if (!storedSession) return null;

      const sessionData = JSON.parse(storedSession);
      
      // Validate session structure and expiry
      if (sessionData?.access_token && sessionData?.expires_at) {
        const now = Date.now() / 1000;
        if (sessionData.expires_at > now) {
          console.log('[useSessionValidation] Valid stored session found');
          return sessionData as Session;
        } else {
          console.log('[useSessionValidation] Stored session expired');
        }
      }
      
      return null;
    } catch (error) {
      console.warn('[useSessionValidation] Error validating stored session:', error);
      return null;
    }
  };

  const checkSession = async () => {
    try {
      console.log('[useSessionValidation] Starting session validation...', { isNative });
      
      // For native apps, prioritize stored session validation
      if (isNative) {
        const storedSession = validateStoredSession();
        if (storedSession) {
          console.log('[useSessionValidation] Using valid stored session for native app');
          setState({
            session: storedSession,
            isLoading: false,
            isValid: true,
            error: null
          });
          return storedSession;
        } else {
          console.log('[useSessionValidation] No valid stored session found for native app');
        }
      }

      // Async validation with reduced timeout for better UX
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session validation timeout')), isNative ? 5000 : 8000)
      );

      const { data: { session }, error } = await Promise.race([
        sessionPromise,
        timeoutPromise
      ]) as any;
      
      if (error) {
        console.error('[useSessionValidation] Session validation error:', error);
        
        // Enhanced native fallback logic
        if (isNative) {
          const localSession = validateStoredSession();
          if (localSession) {
            console.log('[useSessionValidation] Using local session fallback for error case');
            setState({
              session: localSession,
              isLoading: false,
              isValid: true,
              error: null
            });
            return localSession;
          }
        }
        
        setState({
          session: null,
          isLoading: false,
          isValid: false,
          error: error.message
        });
        return null;
      }

      const isValid = !!session?.user && !!session?.access_token;
      
      console.log('[useSessionValidation] Session validation complete:', {
        hasSession: !!session,
        isValid,
        userId: session?.user?.id,
        isNative
      });

      setState({
        session,
        isLoading: false,
        isValid,
        error: null
      });

      return session;
    } catch (error) {
      console.error('[useSessionValidation] Validation failed:', error);
      
      // Enhanced timeout fallback for native apps
      if (isNative && error instanceof Error && error.message?.includes('timeout')) {
        const localSession = validateStoredSession();
        if (localSession) {
          console.log('[useSessionValidation] Using timeout fallback session');
          setState({
            session: localSession,
            isLoading: false,
            isValid: true,
            error: null
          });
          return localSession;
        } else {
          console.log('[useSessionValidation] No fallback session available for timeout');
        }
      }
      
      setState({
        session: null,
        isLoading: false,
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  };

  const refreshSession = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    return await checkSession();
  };

  useEffect(() => {
    checkSession();
  }, [isNative]);

  return {
    ...state,
    refreshSession,
    validateStoredSession
  };
};