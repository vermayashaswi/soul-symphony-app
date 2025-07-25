import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/providers/SessionProvider';

const ProtectedRoute: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const location = useLocation();
  const { sessionState } = useSession();
  
  useEffect(() => {
    // Simplified auth check
    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setUser(data.session?.user || null);
        setIsLoading(false);
      } catch (error) {
        console.error('[ProtectedRoute] Auth check failed:', error);
        setIsLoading(false);
      }
    };
    
    checkAuth();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[ProtectedRoute] Auth changed: ${event}`, !!session?.user);
      setUser(session?.user || null);
      setIsLoading(false);
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  useEffect(() => {
    // Simplified activity tracking
    if (!isLoading && user) {
      console.log('[ProtectedRoute] User authenticated, session active:', sessionState.isActive);
    }
  }, [user, isLoading, sessionState.isActive, location.pathname]);
  
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