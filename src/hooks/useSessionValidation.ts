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

  const validateStoredSession = async (): Promise<Session | null> => {
    try {
      // For native apps, always use Supabase's session management
      if (isNative) {
        console.log('[useSessionValidation] Native app - checking Supabase session directly');
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[useSessionValidation] Native session check error:', error);
          return null;
        }
        return session;
      }

      // For web, check localStorage as fallback
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
      
      // Always use Supabase's getSession for reliable session checking
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[useSessionValidation] Session validation error:', error);
        
        // For native apps, if we get a refresh token error, clear storage and try again
        if (isNative && error.message?.includes('refresh_token_not_found')) {
          console.log('[useSessionValidation] Clearing auth state due to refresh token error');
          await supabase.auth.signOut();
          setState({
            session: null,
            isLoading: false,
            isValid: false,
            error: null // Don't show error for token refresh issues
          });
          return null;
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