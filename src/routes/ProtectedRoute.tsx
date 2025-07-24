
import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { detectTWAEnvironment } from '@/utils/twaDetection';
import { useSession } from '@/providers/SessionProvider';
import { loadingStateManager, LoadingPriority } from '@/services/loadingStateManager';

const ProtectedRoute: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const location = useLocation();
  const { recordActivity } = useSession();
  
  useEffect(() => {
    loadingStateManager.setLoading('auth-check', LoadingPriority.CRITICAL, 'Checking authentication...');
    
    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setUser(data.session?.user || null);
        setIsLoading(false);
        loadingStateManager.clearLoading('auth-check');
      } catch (error) {
        console.error('Error checking authentication in ProtectedRoute:', error);
        setIsLoading(false);
        loadingStateManager.clearLoading('auth-check');
      }
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      setIsLoading(false);
      loadingStateManager.clearLoading('auth-check');
    });
    
    return () => {
      subscription.unsubscribe();
      loadingStateManager.clearLoading('auth-check');
    };
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
    // Loading state is now handled by UnifiedLoadingOverlay
    return null;
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
