/**
 * Native App Route Resolver
 * Handles proper routing for native Capacitor apps
 */

import { nativeIntegrationService } from '@/services/nativeIntegrationService';

export interface NativeRouteInfo {
  isNativeApp: boolean;
  resolvedPath: string;
  shouldRedirect: boolean;
  redirectTo?: string;
}

/**
 * Resolves the correct route for native apps
 * In native apps, all routes should be treated as app routes
 */
export const resolveNativeRoute = (pathname: string): NativeRouteInfo => {
  const isNativeApp = nativeIntegrationService.isRunningNatively();
  
  if (!isNativeApp) {
    return {
      isNativeApp: false,
      resolvedPath: pathname,
      shouldRedirect: false
    };
  }

  console.log('[NativeRouteResolver] Resolving route for native app:', pathname);

  // In native apps, normalize all routes to /app/* structure
  let resolvedPath = pathname;
  let shouldRedirect = false;
  let redirectTo: string | undefined;

  // Handle root route in native app
  if (pathname === '/' || pathname === '') {
    resolvedPath = '/app/dashboard';
    shouldRedirect = true;
    redirectTo = '/app/dashboard';
  }
  // Handle website routes in native app
  else if (!pathname.startsWith('/app/') && pathname !== '/app') {
    // Convert website routes to app routes
    resolvedPath = `/app${pathname}`;
    shouldRedirect = true;
    redirectTo = resolvedPath;
  }
  // Already an app route
  else if (pathname.startsWith('/app/')) {
    resolvedPath = pathname;
  }
  // Handle bare /app route
  else if (pathname === '/app') {
    resolvedPath = '/app/dashboard';
    shouldRedirect = true;
    redirectTo = '/app/dashboard';
  }

  console.log('[NativeRouteResolver] Route resolved:', {
    original: pathname,
    resolved: resolvedPath,
    shouldRedirect,
    redirectTo
  });

  return {
    isNativeApp: true,
    resolvedPath,
    shouldRedirect,
    redirectTo
  };
};

/**
 * Get the appropriate default route for the environment
 */
export const getDefaultRoute = (): string => {
  const isNativeApp = nativeIntegrationService.isRunningNatively();
  
  if (isNativeApp) {
    return '/app/dashboard';
  }
  
  return '/';
};