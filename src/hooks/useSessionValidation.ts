import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { sessionStorageManager } from '@/utils/sessionStorage';
import { debugLogger } from '@/utils/debugLogger';

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
      debugLogger.log('ValidateStoredSession:Start', {});
      
      const sessionData = sessionStorageManager.getStoredSession();
      if (!sessionData) {
        debugLogger.log('ValidateStoredSession:NoData', {});
        return null;
      }

      const isValid = sessionStorageManager.validateSession(sessionData);
      
      debugLogger.logSessionValidation('ValidateStoredSession:Result', sessionData, isValid);
      
      if (isValid) {
        console.log('[useSessionValidation] Valid stored session found');
        return sessionData as Session;
      } else {
        console.log('[useSessionValidation] Stored session invalid or expired');
        return null;
      }
    } catch (error) {
      debugLogger.logError('ValidateStoredSession:Error', error);
      return null;
    }
  };

  const checkSession = async () => {
    try {
      debugLogger.log('CheckSession:Start', { isNative });
      console.log('[useSessionValidation] Starting session validation...');
      
      // For native apps, try synchronous validation first
      if (isNative) {
        debugLogger.log('CheckSession:NativePath', {});
        const storedSession = validateStoredSession();
        if (storedSession) {
          debugLogger.log('CheckSession:NativeSuccess', { 
            sessionExists: true, 
            userExists: !!storedSession.user 
          });
          setState({
            session: storedSession,
            isLoading: false,
            isValid: true,
            error: null
          });
          return storedSession;
        }
        debugLogger.log('CheckSession:NativeFallback', {});
      }

      // Async validation fallback
      debugLogger.log('CheckSession:AsyncPath', {});
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        debugLogger.logError('CheckSession:SupabaseError', error);
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
      
      debugLogger.logSessionValidation('CheckSession:Complete', session, isValid);
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
      debugLogger.logError('CheckSession:UnexpectedError', error);
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