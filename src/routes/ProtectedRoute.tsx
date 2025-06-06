
import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOnboarding } from '@/hooks/use-onboarding';

const ProtectedRoute: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const location = useLocation();
  const { onboardingComplete } = useOnboarding();
  
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
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // If no user, redirect to auth
  if (!user) {
    console.log("ProtectedRoute: No user, redirecting to auth from:", location.pathname);
    return <Navigate to={`/app/auth?redirectTo=${location.pathname}`} replace />;
  }
  
  // If user exists but onboarding not complete, redirect to onboarding
  if (onboardingComplete === false) {
    console.log("ProtectedRoute: User exists but onboarding incomplete, redirecting to onboarding");
    return <Navigate to="/app/onboarding" replace />;
  }
  
  // Use Outlet to render child routes
  return <Outlet />;
};

export default ProtectedRoute;
