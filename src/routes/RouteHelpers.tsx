
import React, { useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// Instead of checking subdomain, now we check path prefix
export const isNativeApp = (): boolean => {
  return /native/i.test(window.navigator.userAgent);
};

// Update the path-based check to be more comprehensive and accurate
export const isAppRoute = (pathname: string): boolean => {
  // Explicitly define app routes - the root path should NEVER be an app route
  const appPrefixes = ['/app/', '/app', '/journal', '/chat', '/insights', '/settings', '/auth', '/profile'];
  
  // Check for specific app routes including paths under /app
  const isApp = appPrefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
  
  // Debug logging
  console.log(`isAppRoute check for ${pathname}: ${isApp}`);
  
  return isApp;
};

// CRITICAL: Always treat Insights as an app route
const isSpecialAppPath = (pathname: string): boolean => {
  // If the path contains insights, it should NEVER be treated as a website route
  return pathname.includes('/insights') || pathname === '/insights';
};

export const isWebsiteRoute = (pathname: string): boolean => {
  // Consider website routes like /about, /pricing, etc.
  const websitePrefixes = ['/about', '/pricing', '/terms', '/privacy', '/blog', '/contact', '/faq'];
  
  // CRITICAL FIX: Special check for Insights page
  if (isSpecialAppPath(pathname)) {
    console.log(`Special case: ${pathname} contains insights, treating as app route`);
    return false;
  }
  
  // The root path (/) is explicitly a website route
  if (pathname === "/" || pathname === "") {
    console.log('Root path / is explicitly a website route');
    return true;
  }
  
  // If it has an app prefix, it's not a website route
  if (isAppRoute(pathname)) {
    console.log(`${pathname} is an app route, so not a website route`);
    return false;
  }
  
  // Check for specific website routes
  const isWebsite = websitePrefixes.some(prefix => 
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  
  // If not explicitly app or explicitly website, treat as website
  const result = isWebsite || (!isAppRoute(pathname) && pathname !== "/app");
  console.log(`isWebsiteRoute check for ${pathname}: ${result}`);
  
  return result;
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
    isAppRoute: isAppRoute(location.pathname),
    isWebsiteRoute: isWebsiteRoute(location.pathname)
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
