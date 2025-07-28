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
      // For native apps, avoid synchronous localStorage access issues
      if (isNative && typeof window === 'undefined') {
        console.log('[useSessionValidation] Skipping localStorage in native environment');
        return null;
      }

      const storedSession = localStorage.getItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
      if (!storedSession) {
        console.log('[useSessionValidation] No stored session found');
        return null;
      }

      const sessionData = JSON.parse(storedSession);
      
      // Enhanced validation for session structure
      if (sessionData?.access_token && sessionData?.expires_at && sessionData?.user) {
        const now = Date.now() / 1000;
        if (sessionData.expires_at > now) {
          console.log('[useSessionValidation] Valid stored session found', {
            userId: sessionData.user?.id,
            expiresIn: sessionData.expires_at - now
          });
          return sessionData as Session;
        } else {
          console.log('[useSessionValidation] Stored session expired');
          // Clean up expired session
          localStorage.removeItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
        }
      } else {
        console.log('[useSessionValidation] Invalid session structure');
      }
      
      return null;
    } catch (error) {
      console.warn('[useSessionValidation] Error validating stored session:', error);
      // Clean up corrupted session data
      try {
        localStorage.removeItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
      } catch (cleanupError) {
        console.warn('[useSessionValidation] Failed to cleanup corrupted session:', cleanupError);
      }
      return null;
    }
  };

  const checkSession = async () => {
    try {
      console.log('[useSessionValidation] Starting session validation...');
      
      // For native apps, try synchronous validation first
      if (isNative) {
        const storedSession = validateStoredSession();
        if (storedSession) {
          setState({
            session: storedSession,
            isLoading: false,
            isValid: true,
            error: null
          });
          return storedSession;
        }
      }

      // Async validation fallback
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[useSessionValidation] Session validation error:', error);
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
        userId: session?.user?.id
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