/**
 * Simplified Route Detection Utility
 * Reduces complexity and improves native app routing reliability
 */

import { nativeIntegrationService } from '@/services/nativeIntegrationService';

export interface RouteInfo {
  isNativeApp: boolean;
  isAppRoute: boolean;
  isWebsiteRoute: boolean;
  shouldRedirectToApp: boolean;
}

/**
 * Simplified route detection that fixes the infinite loop issue
 */
export const detectRouteContext = (pathname: string): RouteInfo => {
  const isNativeApp = nativeIntegrationService.isRunningNatively();
  
  // For native apps - ALL routes are app routes
  if (isNativeApp) {
    return {
      isNativeApp: true,
      isAppRoute: true,
      isWebsiteRoute: false,
      shouldRedirectToApp: false // Already in app context
    };
  }
  
  // For web apps - check route prefixes
  const isAppRoute = pathname.startsWith('/app/') || pathname === '/app';
  const isWebsiteRoute = !isAppRoute;
  
  return {
    isNativeApp: false,
    isAppRoute,
    isWebsiteRoute,
    shouldRedirectToApp: false
  };
};

/**
 * Check if current route is an app route (simplified)
 */
export const isAppRoute = (pathname: string): boolean => {
  const routeInfo = detectRouteContext(pathname);
  
  // Reduced logging to prevent spam
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Route] ${pathname} -> app: ${routeInfo.isAppRoute}, native: ${routeInfo.isNativeApp}`);
  }
  
  return routeInfo.isAppRoute;
};

/**
 * Check if current route is a website route (simplified)
 */
export const isWebsiteRoute = (pathname: string): boolean => {
  const routeInfo = detectRouteContext(pathname);
  return routeInfo.isWebsiteRoute;
};

/**
 * Get the appropriate redirect path for current context
 */
export const getRedirectPath = (currentPath: string, isAuthenticated: boolean): string => {
  const routeInfo = detectRouteContext(currentPath);
  
  // Native apps always redirect to app routes
  if (routeInfo.isNativeApp) {
    if (isAuthenticated) {
      return '/app/home';
    } else {
      return '/app/onboarding';
    }
  }
  
  // Web apps - redirect based on current context
  if (currentPath === '/' || currentPath === '') {
    if (isAuthenticated) {
      return '/app/home';
    } else {
      return '/'; // Stay on marketing site
    }
  }
  
  return currentPath;
};