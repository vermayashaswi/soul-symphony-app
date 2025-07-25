import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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
  
  const [timeoutReached, setTimeoutReached] = useState(false);

  const checkSession = async () => {
    try {
      console.log('[useSessionValidation] Starting session validation...');
      
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
    
    // Add timeout protection to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('[useSessionValidation] Timeout reached, forcing completion');
      setTimeoutReached(true);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: prev.error || 'Session validation timeout'
      }));
    }, 10000); // 10 second timeout
    
    return () => clearTimeout(timeout);
  }, []);

  return {
    ...state,
    refreshSession,
    timeoutReached
  };
};