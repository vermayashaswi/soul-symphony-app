
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
  if (isAppSubdomain()) {
    return 'https://app.soulo.online';
  }
  return 'https://soulo.online';
};

export const isAppRoute = (pathname: string): boolean => {
  // All routes on app subdomain are app routes
  // No app routes on main domain
  return isAppSubdomain();
}

export const getAppPath = (path: string): string => {
  // On app subdomain, all paths are as-is
  if (path.startsWith('/app/')) {
    return path.replace('/app', '');
  }
  return path;
};

export const isWebsiteRoute = (pathname: string): boolean => {
  // Website routes are on main domain only
  // Or specific content routes on app subdomain
  const appSubdomain = isAppSubdomain();
  
  if (appSubdomain) {
    // Only these specific routes are considered website routes on app subdomain
    return pathname.startsWith('/blog') || 
           pathname.startsWith('/faq') || 
           pathname.startsWith('/privacy-policy') || 
           pathname.startsWith('/app-download');
  }
  
  // On main domain, everything is a website route
  return !appSubdomain;
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
  const isOnAppSubdomain = isAppSubdomain();
  
  console.log('AppRouteWrapper rendering:', location.pathname, { 
    requiresAuth, 
    userExists: !!user,
    isOnAppSubdomain
  });
  
  useEffect(() => {
    if (requiresAuth && !user) {
      console.log('Protected route accessed without auth, redirecting to auth');
      
      // Always redirect to /auth on the app subdomain
      navigate('/auth', { 
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
  // Handle absolute URLs (like https://app.soulo.online)
  if (to.startsWith('http')) {
    // For external redirects, use a useEffect to navigate
    useEffect(() => {
      console.log('RedirectRoute: Redirecting to external URL:', to);
      window.location.replace(to);
    }, [to]);
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // For internal redirects, use Navigate
  console.log('RedirectRoute: Redirecting to internal path:', to);
  return <Navigate to={to} replace />;
};
