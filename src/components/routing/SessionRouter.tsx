import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface SessionRouterProps {
  children: React.ReactNode;
  fallbackRoute?: string;
  requireAuth?: boolean;
}

interface SessionState {
  session: Session | null;
  loading: boolean;
  checked: boolean;
}

export const SessionRouter: React.FC<SessionRouterProps> = ({ 
  children, 
  fallbackRoute = '/app/onboarding',
  requireAuth = false 
}) => {
  const [sessionState, setSessionState] = useState<SessionState>({
    session: null,
    loading: true,
    checked: false
  });

  const isNative = nativeIntegrationService.isRunningNatively();

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        console.log('[SessionRouter] Checking session state...');
        
        // For native apps, try to get session synchronously first from localStorage
        if (isNative) {
          try {
            const storedSession = localStorage.getItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
            if (storedSession) {
              const sessionData = JSON.parse(storedSession);
              console.log('[SessionRouter] Found stored session data in native app');
              
              // Quick validation of stored session
              if (sessionData?.access_token && sessionData?.expires_at) {
                const now = Date.now() / 1000;
                if (sessionData.expires_at > now) {
                  console.log('[SessionRouter] Session appears valid, proceeding');
                  if (mounted) {
                    setSessionState({
                      session: sessionData as Session,
                      loading: false,
                      checked: true
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
        
        if (error) {
          console.error('[SessionRouter] Session check error:', error);
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
            checked: true
          });
        }
      } catch (error) {
        console.error('[SessionRouter] Session check failed:', error);
        if (mounted) {
          setSessionState({
            session: null,
            loading: false,
            checked: true
          });
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, [isNative]);

  // Show loading state while checking session
  if (sessionState.loading || !sessionState.checked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">
            {isNative ? 'Loading app...' : 'Checking authentication...'}
          </p>
        </div>
      </div>
    );
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