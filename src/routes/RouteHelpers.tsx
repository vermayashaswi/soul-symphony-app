import React, { useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const isNativeApp = (): boolean => {
  return /native/i.test(window.navigator.userAgent);
};

export const isAppRoute = (pathname: string): boolean => {
  // Handle both app.soulo.online/* and soulo.online/app/*
  const isAppSubdomain = window.location.hostname === 'app.soulo.online';
  
  if (isAppSubdomain) {
    // On app subdomain, all paths are app routes except explicit website routes
    return !pathname.startsWith('/blog') && 
           !pathname.startsWith('/faq') && 
           !pathname.startsWith('/privacy-policy') && 
           !pathname.startsWith('/app-download');
  }
  
  // Standard app path detection for main domain
  return pathname === '/app' || pathname.startsWith('/app/');
};

export const isWebsiteRoute = (pathname: string): boolean => {
  // Website routes are anything that doesn't start with /app
  return !isAppRoute(pathname);
}

export const WebsiteRouteWrapper = ({ element }: { element: React.ReactNode }) => {
  // Website routes don't require any auth
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
  const isAppSubdomain = window.location.hostname === 'app.soulo.online';
  
  console.log('AppRouteWrapper rendering:', location.pathname, { 
    requiresAuth, 
    userExists: !!user,
    isAppSubdomain
  });
  
  useEffect(() => {
    if (requiresAuth && !user) {
      console.log('Protected route accessed without auth, redirecting to auth');
      
      // Adjust redirect path based on subdomain
      if (isAppSubdomain) {
        navigate('/auth', { 
          state: { from: location },
          replace: true
        });
      } else {
        navigate('/app/auth', { 
          state: { from: location },
          replace: true
        });
      }
    }
  }, [user, navigate, requiresAuth, location, isAppSubdomain]);

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
