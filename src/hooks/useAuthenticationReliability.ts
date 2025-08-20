import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  sessionValid: boolean;
  lastValidation: number;
  retryCount: number;
}

const VALIDATION_INTERVAL = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;

export const useAuthenticationReliability = () => {
  const { toast } = useToast();
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    userId: null,
    sessionValid: false,
    lastValidation: 0,
    retryCount: 0
  });

  // Validate current session
  const validateSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[AuthReliability] Session validation error:', error);
        return false;
      }

      const isValid = !!session?.user;
      const userId = session?.user?.id || null;

      setAuthState(prev => ({
        ...prev,
        isAuthenticated: isValid,
        userId,
        sessionValid: isValid,
        lastValidation: Date.now(),
        retryCount: isValid ? 0 : prev.retryCount
      }));

      return isValid;
    } catch (error) {
      console.error('[AuthReliability] Session validation exception:', error);
      return false;
    }
  }, []);

  // Refresh session with retry logic
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('[AuthReliability] Session refresh error:', error);
        setAuthState(prev => ({
          ...prev,
          retryCount: prev.retryCount + 1
        }));
        return false;
      }

      const isValid = !!data?.session?.user;
      const userId = data?.session?.user?.id || null;

      setAuthState(prev => ({
        ...prev,
        isAuthenticated: isValid,
        userId,
        sessionValid: isValid,
        lastValidation: Date.now(),
        retryCount: 0
      }));

      if (isValid) {
        console.log('[AuthReliability] Session refreshed successfully');
      }

      return isValid;
    } catch (error) {
      console.error('[AuthReliability] Session refresh exception:', error);
      setAuthState(prev => ({
        ...prev,
        retryCount: prev.retryCount + 1
      }));
      return false;
    }
  }, []);

  // Automatic retry with exponential backoff
  const retryAuthentication = useCallback(async (): Promise<boolean> => {
    if (authState.retryCount >= MAX_RETRY_ATTEMPTS) {
      toast({
        title: "Authentication Issue",
        description: "Please refresh the page or log in again",
        variant: "destructive"
      });
      return false;
    }

    const delay = Math.min(5000, 1000 * Math.pow(2, authState.retryCount));
    await new Promise(resolve => setTimeout(resolve, delay));

    const refreshed = await refreshSession();
    if (!refreshed) {
      return await validateSession();
    }

    return refreshed;
  }, [authState.retryCount, refreshSession, validateSession, toast]);

  // Check if session needs validation
  const needsValidation = useCallback((): boolean => {
    const timeSinceLastValidation = Date.now() - authState.lastValidation;
    return timeSinceLastValidation > VALIDATION_INTERVAL || !authState.sessionValid;
  }, [authState.lastValidation, authState.sessionValid]);

  // Session health monitoring
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const startMonitoring = () => {
      intervalId = setInterval(async () => {
        if (needsValidation()) {
          console.log('[AuthReliability] Running periodic session validation');
          const isValid = await validateSession();
          
          if (!isValid && authState.retryCount < MAX_RETRY_ATTEMPTS) {
            console.log('[AuthReliability] Session invalid, attempting refresh');
            await retryAuthentication();
          }
        }
      }, VALIDATION_INTERVAL);
    };

    // Initial validation
    validateSession().then(isValid => {
      if (isValid) {
        startMonitoring();
      }
    });

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [validateSession, needsValidation, retryAuthentication, authState.retryCount]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthReliability] Auth state change:', event);
        
        const isValid = !!session?.user;
        const userId = session?.user?.id || null;

        setAuthState(prev => ({
          ...prev,
          isAuthenticated: isValid,
          userId,
          sessionValid: isValid,
          lastValidation: Date.now(),
          retryCount: isValid ? 0 : prev.retryCount
        }));

        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          console.log('[AuthReliability] Auth event processed:', event);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return {
    isAuthenticated: authState.isAuthenticated,
    userId: authState.userId,
    sessionValid: authState.sessionValid,
    retryCount: authState.retryCount,
    validateSession,
    refreshSession,
    retryAuthentication,
    needsValidation: needsValidation()
  };
};