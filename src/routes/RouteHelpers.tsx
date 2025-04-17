
import React, { useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// Instead of checking subdomain, now we check path prefix
export const isNativeApp = (): boolean => {
  return /native/i.test(window.navigator.userAgent);
};

// Remove subdomain check, replace with path-based check
export const isAppRoute = (pathname: string): boolean => {
  return pathname.startsWith('/app/') || pathname === '/app';
};

export const isWebsiteRoute = (pathname: string): boolean => {
  // Website routes are everything not starting with /app/
  return !isAppRoute(pathname);
};

export const getBaseUrl = (): string => {
  // For development environment
  if (window.location.hostname === 'localhost' || window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return window.location.origin;
  }
  
  // For production, always use main domain
  return 'https://soulo.online';
};

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
  
  console.log('AppRouteWrapper rendering:', location.pathname, { 
    requiresAuth, 
    userExists: !!user,
  });
  
  useEffect(() => {
    if (requiresAuth && !user) {
      console.log('Protected route accessed without auth, redirecting to auth');
      
      // Redirect to /app/auth
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
  // Handle absolute URLs (like https://soulo.online)
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
