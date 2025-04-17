
import React, { useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const isNativeApp = (): boolean => {
  return /native/i.test(window.navigator.userAgent);
};

export const isAppSubdomain = (): boolean => {
  return window.location.hostname === 'app.soulo.online';
};

export const getBaseUrl = (): string => {
  return isAppSubdomain() ? '' : '/app';
};

export const isAppRoute = (pathname: string): boolean => {
  // Handle both app.soulo.online/* and soulo.online/app/*
  const appSubdomain = isAppSubdomain();
  
  if (appSubdomain) {
    // On app subdomain, all paths are app routes except explicit website routes
    return !pathname.startsWith('/blog') && 
           !pathname.startsWith('/faq') && 
           !pathname.startsWith('/privacy-policy') && 
           !pathname.startsWith('/app-download');
  }
  
  // On main domain, /app/* paths are app routes
  return pathname === '/app' || pathname.startsWith('/app/');
};

export const getAppPath = (path: string): string => {
  // If we're on the app subdomain, don't prefix with /app
  if (isAppSubdomain()) {
    // Remove /app prefix if it exists
    if (path.startsWith('/app/')) {
      return path.replace('/app', '');
    }
    return path;
  }
  
  // If we're on the main domain and path doesn't already start with /app
  if (!path.startsWith('/app')) {
    return `/app${path}`;
  }
  
  return path;
};

export const isWebsiteRoute = (pathname: string): boolean => {
  // Website routes are anything that doesn't start with /app on main domain
  // Or specific content routes on app subdomain
  const appSubdomain = isAppSubdomain();
  
  if (appSubdomain) {
    // Only these specific routes are considered website routes on app subdomain
    return pathname.startsWith('/blog') || 
           pathname.startsWith('/faq') || 
           pathname.startsWith('/privacy-policy') || 
           pathname.startsWith('/app-download');
  }
  
  // On main domain, everything not starting with /app is a website route
  return !pathname.startsWith('/app');
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
