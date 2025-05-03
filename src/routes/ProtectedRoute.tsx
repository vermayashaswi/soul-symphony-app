
import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ErrorBoundary from '@/components/insights/ErrorBoundary';

const ProtectedRoute: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const location = useLocation();
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First set up the subscription to avoid missing any auth events
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          console.log("Auth state changed:", event);
          setUser(session?.user || null);
          setIsLoading(false);
          
          // Store the redirectTo path for after login
          if (!session?.user && location.pathname !== '/auth') {
            localStorage.setItem('authRedirectTo', location.pathname);
          }
        });
        
        // Then check current session
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error checking session in ProtectedRoute:', error);
          setAuthError(error.message);
        } else {
          setUser(data.session?.user || null);
        }
        setIsLoading(false);
        
        return () => subscription.unsubscribe();
      } catch (error: any) {
        console.error('Unexpected error checking authentication in ProtectedRoute:', error);
        setAuthError(error.message);
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [location.pathname]);
  
  useEffect(() => {
    if (!isLoading && !user) {
      console.log("Protected route: No user, should redirect to /app/auth", {
        path: location.pathname
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
    const redirectPath = `/app/auth?redirectTo=${encodeURIComponent(location.pathname)}`;
    console.log("Redirecting to auth from protected route:", location.pathname, "→", redirectPath);
    return <Navigate to={redirectPath} replace />;
  }
  
  // Use ErrorBoundary to catch any errors in the child routes
  return (
    <ErrorBoundary fallback={
      <div className="p-6 bg-background border rounded-lg shadow-sm m-4">
        <h2 className="text-lg font-semibold mb-2">Something went wrong in the protected area</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {authError || "An unexpected error occurred while loading this page"}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-white rounded-md"
        >
          Try Reloading
        </button>
      </div>
    }>
      <Outlet />
    </ErrorBoundary>
  );
};

export default ProtectedRoute;
