
import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';


const ProtectedRoute: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const location = useLocation();
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('[ProtectedRoute] Checking authentication...');
        const { data } = await supabase.auth.getSession();
        console.log('[ProtectedRoute] Session status:', data.session ? 'authenticated' : 'not authenticated');
        setUser(data.session?.user || null);
        setIsLoading(false);
      } catch (error) {
        console.error('[ProtectedRoute] Error checking authentication:', error);
        setIsLoading(false);
      }
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[ProtectedRoute] Auth state changed:', event, session ? 'authenticated' : 'not authenticated');
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
    }
  }, [user, isLoading, location]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    console.log("[ProtectedRoute] User not authenticated, redirecting to auth page");
    
    // Add additional debug info for iOS devices
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      console.log('[ProtectedRoute] iOS device detected, authentication may require Apple ID or improved Google OAuth');
    }
    
    // Store redirect path and go to auth
    localStorage.setItem('authRedirectTo', location.pathname);
    return <Navigate to="/app/auth" replace />;
  }
  
  // Use Outlet to render child routes
  return <Outlet />;
};

export default ProtectedRoute;
