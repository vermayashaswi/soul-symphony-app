
import React, { useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const isNativeApp = (): boolean => {
  return /native/i.test(window.navigator.userAgent);
};

export const isAppRoute = (pathname: string): boolean => {
  return pathname.startsWith('/app');
};

export const WebsiteRouteWrapper = ({ element }: { element: React.ReactNode }) => {
  return (
    <div className="website-route">
      {element}
    </div>
  );
};

export const AppRouteWrapper = ({ 
  element, 
  requiresAuth = true,
  hideNavbar = false 
}: { 
  element: React.ReactNode, 
  requiresAuth?: boolean,
  hideNavbar?: boolean 
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  console.log('AppRouteWrapper rendering:', location.pathname, { 
    requiresAuth, 
    userExists: !!user 
  });
  
  useEffect(() => {
    if (requiresAuth && !user) {
      console.log('Protected route accessed without auth, redirecting to /app/auth');
      navigate('/app/auth', { 
        state: { from: location },
        replace: true
      });
    }
  }, [user, navigate, requiresAuth, location]);

  // If this is a protected route and user is not authenticated,
  // render nothing while the redirect happens
  if (requiresAuth && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-route">
      <div className="min-h-screen">
        {element}
      </div>
    </div>
  );
};

export const RedirectRoute = ({ to }: { to: string }) => {
  console.log('RedirectRoute: Redirecting to', to);
  return <Navigate to={to} replace />;
};
