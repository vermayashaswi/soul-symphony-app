import { useAppState } from './useAppState';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

// Legacy hook - now uses centralized app state manager
export const useSessionValidation = () => {
  const { session, isInitializing, error, isAuthenticated } = useAppState();

  const validateStoredSession = (): Session | null => {
    try {
      const stored = localStorage.getItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
      if (!stored) return null;
      
      const sessionData = JSON.parse(stored);
      const now = Date.now() / 1000;
      
      if (sessionData?.access_token && sessionData?.expires_at && sessionData.expires_at > now) {
        return sessionData as Session;
      }
    } catch (error) {
      console.warn('[SessionValidation] Failed to parse stored session:', error);
    }
    return null;
  };

  const refreshSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      console.error('[SessionValidation] Refresh failed:', error);
      return null;
    }
  };

  return {
    session,
    isLoading: isInitializing,
    isValid: isAuthenticated,
    error,
    refreshSession,
    validateStoredSession
  };
};