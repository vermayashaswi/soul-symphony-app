import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SessionSyncOptions {
  onSessionLost?: () => void;
  onSessionRestored?: () => void;
  autoRefresh?: boolean;
}

export const useSessionSync = (options: SessionSyncOptions = {}) => {
  const { onSessionLost, onSessionRestored, autoRefresh = true } = options;
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSessionStateRef = useRef<boolean>(false);

  const checkAndRefreshSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[SessionSync] Session check error:', error);
        if (lastSessionStateRef.current) {
          onSessionLost?.();
          lastSessionStateRef.current = false;
        }
        return false;
      }

      const hasValidSession = !!session?.user;
      
      // Detect session state changes
      if (hasValidSession !== lastSessionStateRef.current) {
        if (hasValidSession) {
          console.log('[SessionSync] Session restored');
          onSessionRestored?.();
        } else {
          console.log('[SessionSync] Session lost');
          onSessionLost?.();
        }
        lastSessionStateRef.current = hasValidSession;
      }

      // Auto-refresh if session is expiring soon (within 5 minutes)
      if (autoRefresh && session?.expires_at) {
        const expiresAt = new Date(session.expires_at * 1000);
        const now = new Date();
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        const fiveMinutes = 5 * 60 * 1000;

        if (timeUntilExpiry <= fiveMinutes && timeUntilExpiry > 0) {
          console.log('[SessionSync] Refreshing session - expires soon');
          const { data: refreshedSession, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.error('[SessionSync] Session refresh failed:', refreshError);
            toast.error('Session expired. Please sign in again.');
            return false;
          } else {
            console.log('[SessionSync] Session refreshed successfully');
          }
        }
      }

      return hasValidSession;
    } catch (error) {
      console.error('[SessionSync] Unexpected error during session check:', error);
      return false;
    }
  }, [onSessionLost, onSessionRestored, autoRefresh]);

  const forceSessionRefresh = useCallback(async () => {
    console.log('[SessionSync] Force refreshing session');
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('[SessionSync] Force refresh failed:', error);
        toast.error('Failed to refresh session. Please sign in again.');
        return false;
      }
      
      console.log('[SessionSync] Session force refreshed successfully');
      return true;
    } catch (error) {
      console.error('[SessionSync] Exception during force refresh:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    // Initial session check
    checkAndRefreshSession();

    // Set up periodic session monitoring (every 2 minutes)
    sessionCheckIntervalRef.current = setInterval(checkAndRefreshSession, 2 * 60 * 1000);

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[SessionSync] Auth state changed:', event, !!session);
      
      const hasValidSession = !!session?.user;
      
      if (hasValidSession !== lastSessionStateRef.current) {
        if (hasValidSession) {
          onSessionRestored?.();
        } else {
          onSessionLost?.();
        }
        lastSessionStateRef.current = hasValidSession;
      }
    });

    return () => {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
      subscription.unsubscribe();
    };
  }, [checkAndRefreshSession, onSessionLost, onSessionRestored]);

  return {
    checkSession: checkAndRefreshSession,
    refreshSession: forceSessionRefresh
  };
};