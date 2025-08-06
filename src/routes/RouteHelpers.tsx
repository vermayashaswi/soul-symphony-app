
import React, { useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

// Instead of checking subdomain, now we check path prefix
export const isNativeApp = (): boolean => {
  return /native/i.test(window.navigator.userAgent);
};

// CRITICAL FIX: Memoized route check to prevent infinite loops
const routeCheckCache = new Map<string, { result: boolean; timestamp: number; isNative: boolean }>();
const ROUTE_CACHE_DURATION = 5000; // 5 seconds

export const isAppRoute = (pathname: string): boolean => {
  const now = Date.now();
  const isNative = nativeIntegrationService.isRunningNatively();
  const cacheKey = `${pathname}-${isNative}`;
  
  // Check cache
  const cached = routeCheckCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < ROUTE_CACHE_DURATION && cached.isNative === isNative) {
    return cached.result;
  }
  
  let result: boolean;
  
  // For native apps, ALL routes are considered app routes
  if (isNative) {
    console.log(`[RouteHelpers] isAppRoute check for ${pathname}: true (native app - all routes are app routes)`);
    result = true;
  } else {
    // For web apps, app routes must start with /app/ or be exactly /app
    result = pathname.startsWith('/app/') || pathname === '/app';
    console.log(`[RouteHelpers] isAppRoute check for ${pathname}: ${result} (web app)`);
  }
  
  // Cache the result
  routeCheckCache.set(cacheKey, { result, timestamp: now, isNative });
  
  // Clean old cache entries
  if (routeCheckCache.size > 50) {
    const cutoff = now - ROUTE_CACHE_DURATION;
    for (const [key, value] of routeCheckCache.entries()) {
      if (value.timestamp < cutoff) {
        routeCheckCache.delete(key);
      }
    }
  }
  
  return result;
};

export const isWebsiteRoute = (pathname: string): boolean => {
  const now = Date.now();
  const isNative = nativeIntegrationService.isRunningNatively();
  const cacheKey = `website-${pathname}-${isNative}`;
  
  // Check cache
  const cached = routeCheckCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < ROUTE_CACHE_DURATION && cached.isNative === isNative) {
    return cached.result;
  }
  
  let result: boolean;
  
  // For native apps, NO routes are website routes - everything is treated as app routes
  if (isNative) {
    console.log(`[RouteHelpers] ${pathname} is not a website route (native app - all routes are app routes)`);
    result = false;
  } else {
    // If it has an app prefix, it's not a website route
    if (isAppRoute(pathname)) {
      console.log(`[RouteHelpers] ${pathname} is an app route, so not a website route`);
      result = false;
    } else if (pathname === '/') {
      // For root URL (/), consider it as a website route in web mode
      console.log(`[RouteHelpers] ${pathname} is root, treating as website route (web mode)`);
      result = true;
    } else {
      // Explicitly define website routes for web mode
      const websitePrefixes = ['/', '/about', '/pricing', '/terms', '/privacy', '/blog', '/contact', '/faq', '/download'];
      
      // Check for specific website routes
      result = websitePrefixes.some(prefix => 
        pathname === prefix || pathname.startsWith(`${prefix}/`)
      );
      
      console.log(`[RouteHelpers] isWebsiteRoute check for ${pathname}: ${result} (web mode)`);
    }
  }
  
  // Cache the result
  routeCheckCache.set(cacheKey, { result, timestamp: now, isNative });
  
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
  
  console.log('[RouteHelpers] AppRouteWrapper rendering:', location.pathname, { 
    requiresAuth, 
    userExists: !!user,
    isAppRoute: isAppRoute(location.pathname),
    isNative: nativeIntegrationService.isRunningNatively()
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
  // Handle absolute URLs - redirect to app routes in native context
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
