
import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const ProtectedRoute: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const location = useLocation();
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        // Handle specific auth errors gracefully
        if (error) {
          console.error('ProtectedRoute auth error:', error);
          
          // If it's an invalid refresh token, clear auth state
          if (error.message.includes('refresh_token_not_found')) {
            console.log('ProtectedRoute: Invalid refresh token, clearing auth state');
            
            // Clear any invalid tokens
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
              if (key.startsWith('supabase.auth.token')) {
                localStorage.removeItem(key);
              }
            });
            
            setUser(null);
            setAuthError('Session expired');
            setIsLoading(false);
            return;
          }
          
          setAuthError(error.message);
          setUser(null);
        } else {
          setUser(data.session?.user || null);
          setAuthError(null);
        }
        
        setIsLoading(false);
      } catch (error: any) {
        console.error('Error checking authentication in ProtectedRoute:', error);
        setAuthError(error.message);
        setUser(null);
        setIsLoading(false);
      }
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('ProtectedRoute: Auth state changed:', event);
      
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user || null);
        setAuthError(null);
        setIsLoading(false);
      } else if (event === 'SIGNED_IN') {
        setUser(session?.user || null);
        setAuthError(null);
        setIsLoading(false);
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  useEffect(() => {
    if (!isLoading && !user) {
      console.log("Protected route: No user, should redirect to /app/onboarding", {
        path: location.pathname,
        authError
      });
    }
  }, [user, isLoading, location, authError]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    console.log("Redirecting to onboarding from protected route:", location.pathname, { authError });
    
    // Clear any remaining auth redirect to prevent loops
    localStorage.removeItem('authRedirectTo');
    
    return <Navigate to={`/app/onboarding?redirectTo=${location.pathname}`} replace />;
  }
  
  // Use Outlet to render child routes
  return <Outlet />;
};

export default ProtectedRoute;
