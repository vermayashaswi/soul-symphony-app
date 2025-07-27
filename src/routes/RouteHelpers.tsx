
import React, { useEffect, useMemo } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

// Instead of checking subdomain, now we check path prefix
export const isNativeApp = (): boolean => {
  return /native/i.test(window.navigator.userAgent);
};

// Memoized route checking to prevent unnecessary re-computations
const isNativeCache = new Map<string, boolean>();
const isAppRouteCache = new Map<string, boolean>();

// CRITICAL FIX: Update the path-based check to treat ALL routes as app routes for native apps
export const isAppRoute = (pathname: string): boolean => {
  // Check cache first
  if (isAppRouteCache.has(pathname)) {
    return isAppRouteCache.get(pathname)!;
  }
  
  let result: boolean;
  
  // For native apps, ALL routes are considered app routes
  if (nativeIntegrationService.isRunningNatively()) {
    result = true;
  } else {
    // For web apps, app routes must start with /app/ or be exactly /app
    result = pathname.startsWith('/app/') || pathname === '/app';
  }
  
  // Cache the result
  isAppRouteCache.set(pathname, result);
  return result;
};

const websiteRouteCache = new Map<string, boolean>();

export const isWebsiteRoute = (pathname: string): boolean => {
  // Check cache first
  if (websiteRouteCache.has(pathname)) {
    return websiteRouteCache.get(pathname)!;
  }
  
  let result: boolean;
  
  // For native apps, NO routes are website routes - everything is treated as app routes
  if (nativeIntegrationService.isRunningNatively()) {
    result = false;
  } else {
    // If it has an app prefix, it's not a website route
    if (isAppRoute(pathname)) {
      result = false;
    } else if (pathname === '/') {
      // For root URL (/), consider it as a website route in web mode
      result = true;
    } else {
      // Explicitly define website routes for web mode
      const websitePrefixes = ['/', '/about', '/pricing', '/terms', '/privacy', '/blog', '/contact', '/faq', '/download'];
      
      // Check for specific website routes
      result = websitePrefixes.some(prefix => 
        pathname === prefix || pathname.startsWith(`${prefix}/`)
      );
    }
  }
  
  // Cache the result
  websiteRouteCache.set(pathname, result);
  return result;
};

export const getBaseUrl = (): string => {
  // For development environment
  if (window.location.hostname === 'localhost' || window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return window.location.origin;
  }
  
  // For production native app, use relative path
  return window.location.origin;
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
  
  
  useEffect(() => {
    if (requiresAuth && !user) {
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
  // Handle absolute URLs - redirect to app routes in native context
  if (to.startsWith('http')) {
    // For external redirects, use a useEffect to navigate
    useEffect(() => {
      window.location.replace(to);
    }, [to]);
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // For internal redirects, use Navigate
  return <Navigate to={to} replace />;
};
