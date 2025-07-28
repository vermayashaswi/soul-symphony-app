import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { authTokenStorage } from '@/utils/authTokenStorage';
import AppLoadingScreen from './AppLoadingScreen';

interface SessionRouterProps {
  children: React.ReactNode;
  fallbackRoute?: string;
  requireAuth?: boolean;
}

interface SessionState {
  session: Session | null;
  loading: boolean;
  checked: boolean;
  error: string | null;
  timeout: boolean;
}

export const SessionRouter: React.FC<SessionRouterProps> = ({ 
  children, 
  fallbackRoute = '/app/onboarding',
  requireAuth = false 
}) => {
  const [sessionState, setSessionState] = useState<SessionState>({
    session: null,
    loading: true,
    checked: false,
    error: null,
    timeout: false
  });

  const isNative = nativeIntegrationService.isRunningNatively();

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const checkSession = async () => {
      try {
        console.log('[SessionRouter] Checking session state...');
        
        // Set a timeout for session checking to prevent indefinite loading
        timeoutId = setTimeout(() => {
          if (mounted) {
            console.warn('[SessionRouter] Session check timeout reached');
            setSessionState(prev => ({
              ...prev,
              loading: false,
              checked: true,
              timeout: true,
              error: 'Session check timeout'
            }));
          }
        }, 10000); // 10 second timeout
        
        // For native apps, try to get session synchronously first from localStorage
        if (isNative) {
          try {
            const storedSession = authTokenStorage.getAuthToken();
            if (storedSession) {
              const sessionData = JSON.parse(storedSession);
              console.log('[SessionRouter] Found stored session data in native app');
              
              // Quick validation of stored session
              if (sessionData?.access_token && sessionData?.expires_at) {
                const now = Date.now() / 1000;
                if (sessionData.expires_at > now) {
                  console.log('[SessionRouter] Session appears valid, proceeding');
                  clearTimeout(timeoutId);
                  if (mounted) {
                    setSessionState({
                      session: sessionData as Session,
                      loading: false,
                      checked: true,
                      error: null,
                      timeout: false
                    });
                  }
                  return;
                }
              }
            }
          } catch (error) {
            console.warn('[SessionRouter] Error reading stored session:', error);
          }
        }

        // Fallback to async session check
        const { data: { session }, error } = await supabase.auth.getSession();
        
        clearTimeout(timeoutId);
        
        if (error) {
          console.error('[SessionRouter] Session check error:', error);
          if (mounted) {
            setSessionState({
              session: null,
              loading: false,
              checked: true,
              error: error.message,
              timeout: false
            });
          }
          return;
        }

        console.log('[SessionRouter] Session check result:', {
          hasSession: !!session,
          userId: session?.user?.id,
          isNative
        });

        if (mounted) {
          setSessionState({
            session,
            loading: false,
            checked: true,
            error: null,
            timeout: false
          });
        }
      } catch (error) {
        console.error('[SessionRouter] Session check failed:', error);
        clearTimeout(timeoutId);
        if (mounted) {
          setSessionState({
            session: null,
            loading: false,
            checked: true,
            error: error instanceof Error ? error.message : 'Unknown error',
            timeout: false
          });
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isNative]);

  // Show loading state while checking session
  if (sessionState.loading || !sessionState.checked) {
    return (
      <AppLoadingScreen 
        message={isNative ? 'Loading app...' : 'Checking authentication...'}
        isNative={isNative}
        error={sessionState.error}
        timeout={sessionState.timeout}
      />
    );
  }

  // Handle timeout or persistent errors - proceed without session to avoid infinite loading
  if (sessionState.timeout || sessionState.error) {
    console.warn('[SessionRouter] Proceeding despite timeout/error to prevent infinite loading');
  }

  // Handle authentication requirements
  if (requireAuth && !sessionState.session) {
    console.log('[SessionRouter] Auth required but no session, redirecting to:', fallbackRoute);
    return <Navigate to={fallbackRoute} replace />;
  }

  // For native apps with valid session, redirect authenticated users away from auth pages
  if (isNative && sessionState.session) {
    const currentPath = window.location.pathname;
    const authPaths = ['/app/auth', '/app/onboarding', '/'];
    
    if (authPaths.includes(currentPath)) {
      console.log('[SessionRouter] Native app with session on auth path, redirecting to home');
      return <Navigate to="/app/home" replace />;
    }
  }

  return <>{children}</>;
};

export default SessionRouter;