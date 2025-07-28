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
    let timeoutId: NodeJS.Timeout | null = null;

    const checkSession = async () => {
      try {
        console.log('[SessionRouter] Starting session check...');
        
        // For native apps, use optimized session validation
        if (isNative) {
          try {
            const storedSession = localStorage.getItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
            if (storedSession) {
              const sessionData = JSON.parse(storedSession);
              
              // Enhanced validation with buffer time
              if (sessionData?.access_token && sessionData?.expires_at && sessionData?.user) {
                const now = Date.now() / 1000;
                const buffer = 60; // 60 second buffer
                
                if (sessionData.expires_at > (now + buffer)) {
                  console.log('[SessionRouter] Valid stored session found for native app');
                  if (mounted) {
                    setSessionState({
                      session: sessionData as Session,
                      loading: false,
                      checked: true
                    });
                  }
                  return;
                } else {
                  console.log('[SessionRouter] Stored session expired or expiring soon, clearing');
                  localStorage.removeItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
                }
              }
            }
          } catch (error) {
            console.warn('[SessionRouter] Error reading stored session:', error);
            // Clean up corrupted session data
            try {
              localStorage.removeItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
            } catch (cleanupError) {
              console.warn('[SessionRouter] Failed to cleanup corrupted session');
            }
          }
        }

        // Add timeout for native apps to prevent infinite loading
        if (isNative) {
          timeoutId = setTimeout(() => {
            console.warn('[SessionRouter] Session check timeout for native app');
            if (mounted) {
              setSessionState({
                session: null,
                loading: false,
                checked: true
              });
            }
          }, 3000); // 3 second timeout for native
        }

        // Async session check with shorter timeout for native
        const controller = new AbortController();
        const timeoutDuration = isNative ? 2000 : 5000;
        
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session check timeout')), timeoutDuration)
        );

        const sessionPromise = supabase.auth.getSession();
        
        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as { data: { session: Session | null }, error: any };
        
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        if (error) {
          console.error('[SessionRouter] Session check error:', error);
        }

        console.log('[SessionRouter] Session check completed:', {
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
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
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
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
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