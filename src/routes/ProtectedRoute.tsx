
import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const ProtectedRoute: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const location = useLocation();
  
  useEffect(() => {
    console.log('ProtectedRoute: Checking auth at', location.pathname);
    
    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setUser(data.session?.user || null);
        console.log('ProtectedRoute: Auth check complete', { user: !!data.session?.user });
      } catch (error) {
        console.error('ProtectedRoute: Auth check error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('ProtectedRoute: Auth state changed', { event, user: !!session?.user });
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
  
  if (!user) {
    console.log('ProtectedRoute: No user, redirecting to onboarding');
    return <Navigate to={`/app/onboarding?redirectTo=${location.pathname}`} replace />;
  }
  
  return <Outlet />;
};

export default ProtectedRoute;
