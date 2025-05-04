
import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ProtectedRoute: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const location = useLocation();
  
  useEffect(() => {
    console.log('ProtectedRoute mounted, checking auth status at path:', location.pathname);
    
    const checkAuth = async () => {
      try {
        console.log('Fetching auth session');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting auth session:', error);
          setAuthError(error.message);
          setIsLoading(false);
          return;
        }
        
        console.log('Auth session result:', {
          hasSession: !!data.session,
          userId: data.session?.user?.id || 'none'
        });
        
        setUser(data.session?.user || null);
        setIsLoading(false);
      } catch (error: any) {
        console.error('Unexpected error checking authentication:', error);
        setAuthError(error.message || 'Authentication check failed');
        setIsLoading(false);
      }
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, {
        hasSession: !!session,
        userId: session?.user?.id || 'none'
      });
      setUser(session?.user || null);
      setIsLoading(false);
    });
    
    return () => {
      console.log('ProtectedRoute unmounting, cleaning up subscription');
      subscription.unsubscribe();
    };
  }, [location.pathname]);
  
  useEffect(() => {
    if (!isLoading) {
      if (authError) {
        toast.error(`Authentication error: ${authError}`);
        console.error('Auth error in ProtectedRoute:', authError);
      } else if (!user) {
        console.log("Protected route: No user, redirecting to /app/auth", {
          path: location.pathname
        });
      } else {
        console.log("User authenticated in ProtectedRoute:", {
          userId: user.id,
          path: location.pathname
        });
      }
    }
  }, [user, isLoading, authError, location]);
  
  if (isLoading) {
    console.log('ProtectedRoute: Still loading authentication state...');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <div className="ml-3">Loading authentication state...</div>
      </div>
    );
  }
  
  if (!user) {
    console.log("Redirecting to auth from protected route:", location.pathname);
    // Pass the current path as a redirectTo parameter
    return <Navigate to={`/app/auth?redirectTo=${encodeURIComponent(location.pathname)}`} replace />;
  }
  
  // User is authenticated, render the child routes
  console.log("User authenticated, rendering protected route children:", location.pathname);
  return <Outlet />;
};

export default ProtectedRoute;
