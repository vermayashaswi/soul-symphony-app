
import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { detectTWAEnvironment } from '@/utils/twaDetection';
import { useSession } from '@/providers/SessionProvider';

const ProtectedRoute: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const location = useLocation();
  const { recordActivity } = useSession();
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Add timeout for session check in native apps
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session check timeout')), 10000)
        );

        const { data } = await Promise.race([sessionPromise, timeoutPromise]) as any;
        setUser(data?.session?.user || null);
        setIsLoading(false);
      } catch (error) {
        console.error('Error checking authentication in ProtectedRoute:', error);
        
        // For timeout errors in native apps, try localStorage fallback
        const twaEnv = detectTWAEnvironment();
        if ((twaEnv.isTWA || twaEnv.isStandalone) && error instanceof Error && error.message.includes('timeout')) {
          try {
            const storedToken = localStorage.getItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
            if (storedToken) {
              const sessionData = JSON.parse(storedToken);
              if (sessionData?.user && sessionData.expires_at > Date.now() / 1000) {
                console.log('[ProtectedRoute] Using stored session as fallback');
                setUser(sessionData.user);
                setIsLoading(false);
                return;
              }
            }
          } catch (localError) {
            console.warn('[ProtectedRoute] Could not parse stored session:', localError);
          }
        }
        
        setIsLoading(false);
      }
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[ProtectedRoute] Auth state changed:', event, !!session);
      setUser(session?.user || null);
      setIsLoading(false);
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  useEffect(() => {
    if (!isLoading && !user) {
      console.log("[ProtectedRoute] No user detected, should redirect to onboarding", {
        path: location.pathname,
        isLoading,
        hasUser: !!user
      });
    } else if (!isLoading && user) {
      console.log("[ProtectedRoute] User authenticated, allowing access", {
        path: location.pathname,
        userEmail: user.email
      });
      
      // Record activity when user accesses protected routes
      recordActivity();
    }
  }, [user, isLoading, location, recordActivity]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    console.log("[ProtectedRoute] REDIRECTING to auth from protected route:", location.pathname);
    
    // Store redirect path and go to auth
    localStorage.setItem('authRedirectTo', location.pathname);
    return <Navigate to="/app/auth" replace />;
  }
  
  // Use Outlet to render child routes
  return <Outlet />;
};

export default ProtectedRoute;
