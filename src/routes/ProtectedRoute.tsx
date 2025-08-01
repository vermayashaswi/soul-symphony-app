
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
        const { data } = await supabase.auth.getSession();
        setUser(data.session?.user || null);
        setIsLoading(false);
      } catch (error) {
        console.error('Error checking authentication in ProtectedRoute:', error);
        setIsLoading(false);
      }
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    console.log("[ProtectedRoute] REDIRECTING unauthenticated user to onboarding:", location.pathname);
    
    // Store redirect path for after authentication + onboarding
    localStorage.setItem('authRedirectTo', location.pathname);
    return <Navigate to="/app/onboarding" replace />;
  }
  
  // Use Outlet to render child routes
  return <Outlet />;
};

export default ProtectedRoute;
