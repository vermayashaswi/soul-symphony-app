
import React, { useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// Check if running in native app
export const isNativeApp = (): boolean => {
  return /native/i.test(window.navigator.userAgent);
};

// Check if route is an app route
export const isAppRoute = (pathname: string): boolean => {
  const isApp = pathname.startsWith('/app/') || pathname === '/app';
  console.log(`RouteHelpers: isAppRoute(${pathname}) = ${isApp}`);
  return isApp;
};

// Check if route is a website route
export const isWebsiteRoute = (pathname: string): boolean => {
  // If it's an app route, it's not a website route
  if (isAppRoute(pathname)) {
    return false;
  }
  
  // Root path is a website route
  if (pathname === '/') {
    return true;
  }
  
  // Website route prefixes
  const websitePrefixes = ['/about', '/pricing', '/terms', '/privacy', '/blog', '/contact', '/faq', '/download'];
  
  const isWebsite = websitePrefixes.some(prefix => 
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  
  console.log(`RouteHelpers: isWebsiteRoute(${pathname}) = ${isWebsite}`);
  return isWebsite;
};

// Get base URL
export const getBaseUrl = (): string => {
  if (window.location.hostname === 'localhost' || window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return window.location.origin;
  }
  return 'https://soulo.online';
};

// Website route wrapper
export const WebsiteRouteWrapper = ({ element }: { element: React.ReactNode }) => {
  return (
    <div className="website-route">
      {element}
    </div>
  );
};

// App route wrapper
export const AppRouteWrapper = ({ 
  element, 
  requiresAuth = true 
}: { 
  element: React.ReactNode, 
  requiresAuth?: boolean 
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  console.log('AppRouteWrapper:', { 
    path: location.pathname,
    requiresAuth, 
    user: !!user 
  });
  
  useEffect(() => {
    if (requiresAuth && !user) {
      console.log('AppRouteWrapper: Redirecting to auth');
      navigate('/app/auth', { 
        state: { from: location },
        replace: true
      });
    }
  }, [user, navigate, requiresAuth, location]);

  if (requiresAuth && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-route">
      {element}
    </div>
  );
};

// Redirect route component
export const RedirectRoute = ({ to }: { to: string }) => {
  useEffect(() => {
    if (to.startsWith('http')) {
      console.log('RedirectRoute: External redirect to:', to);
      window.location.replace(to);
    }
  }, [to]);
  
  if (to.startsWith('http')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  console.log('RedirectRoute: Internal redirect to:', to);
  return <Navigate to={to} replace />;
};
