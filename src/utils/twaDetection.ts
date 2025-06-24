
/**
 * Utility functions for detecting TWA (Trusted Web App) environment
 * and handling TWA-specific behaviors
 */

export interface TWAEnvironment {
  isTWA: boolean;
  isAndroidTWA: boolean;
  isStandalone: boolean;
  canExit: boolean;
  hasPermissionDelegation: boolean;
}

/**
 * Detects if the app is running in a TWA environment with improved accuracy
 */
export const detectTWAEnvironment = (): TWAEnvironment => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isAndroid = /android/i.test(userAgent);
  
  // Check for standalone mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  // Enhanced TWA detection with permission delegation check
  const hasTWAIndicators = 
    // WebView indicator
    userAgent.includes('wv') ||
    // Chrome Custom Tabs indicators
    (isAndroid && userAgent.includes('chrome') && !userAgent.includes('mobile safari')) ||
    // TWA-specific user agent patterns
    userAgent.includes('twa') ||
    // Check for lack of browser UI in standalone mode
    (isStandalone && isAndroid) ||
    // Check for TWA package name in referrer or origin
    (document.referrer.includes('com.rhasys.soulo') || 
     window.location.search.includes('twa=true')) ||
    // Check for Capacitor TWA indicators
    window.location.search.includes('forceHideBadge=true');

  // Check for permission delegation (TWA feature)
  const hasPermissionDelegation = checkPermissionDelegation();

  // Enhanced detection: TWA if standalone AND has indicators, OR explicit TWA markers
  const isTWA = (isStandalone && hasTWAIndicators) || 
                userAgent.includes('twa') ||
                window.location.search.includes('twa=true') ||
                hasPermissionDelegation;
  
  console.log('[TWA Detection]', {
    userAgent,
    isAndroid,
    isStandalone,
    hasTWAIndicators,
    hasPermissionDelegation,
    isTWA,
    referrer: document.referrer,
    search: window.location.search
  });
  
  return {
    isTWA,
    isAndroidTWA: isTWA && isAndroid,
    isStandalone,
    canExit: isTWA || isStandalone,
    hasPermissionDelegation
  };
};

/**
 * Check if permission delegation is available (TWA feature)
 */
const checkPermissionDelegation = (): boolean => {
  try {
    // Check if we're running in a context that has permission delegation
    // This is a TWA-specific feature where the native app can handle permissions
    
    // Check for Android TWA permission delegation indicators
    const hasAndroidDelegation = 
      // Check if we have access to Android-specific permission APIs
      'permissions' in navigator &&
      // Check for TWA-specific permission handling
      typeof (navigator as any).permissions.request === 'function' &&
      // Check for Android WebView context
      /android/i.test(navigator.userAgent) &&
      // Check for standalone mode (required for TWA)
      window.matchMedia('(display-mode: standalone)').matches;

    // Check for Capacitor-based TWA indicators
    const hasCapacitorDelegation = 
      // Check if we're running through Capacitor
      window.location.search.includes('forceHideBadge=true') ||
      // Check for Capacitor global
      typeof (window as any).Capacitor !== 'undefined';

    console.log('[Permission Delegation Check]', {
      hasAndroidDelegation,
      hasCapacitorDelegation,
      userAgent: navigator.userAgent
    });

    return hasAndroidDelegation || hasCapacitorDelegation;
  } catch (error) {
    console.warn('[Permission Delegation Check] Error:', error);
    return false;
  }
};

/**
 * Route-aware TWA detection - only applies TWA logic to app routes
 */
export const shouldApplyTWALogic = (currentPath: string): boolean => {
  const twaEnv = detectTWAEnvironment();
  
  console.log('[TWA Logic Check]', {
    currentPath,
    isTWA: twaEnv.isTWA,
    isStandalone: twaEnv.isStandalone,
    hasPermissionDelegation: twaEnv.hasPermissionDelegation,
    isAppRoute: currentPath.startsWith('/app')
  });
  
  // Only apply TWA logic if we're actually in a TWA environment AND on app routes
  if (!twaEnv.isTWA && !twaEnv.isStandalone) {
    return false;
  }
  
  // Only apply to /app routes, not marketing website routes
  return currentPath.startsWith('/app');
};

/**
 * Attempts to exit the TWA/PWA app
 */
export const exitTWAApp = (): void => {
  const currentPath = window.location.pathname;
  
  // Only allow exit from app routes
  if (!shouldApplyTWALogic(currentPath)) {
    console.warn('TWA exit not available for marketing website routes');
    return;
  }
  
  const twaEnv = detectTWAEnvironment();
  
  if (twaEnv.canExit) {
    try {
      // For TWA, try to close the window
      if (window.close) {
        window.close();
      }
      
      // Fallback: Navigate to a special exit page or external URL
      // This might prompt the user to close the app
      setTimeout(() => {
        window.location.href = 'about:blank';
      }, 100);
      
    } catch (error) {
      console.warn('Could not exit TWA app:', error);
      // Last resort: navigate to external page which might close TWA
      window.location.href = 'https://google.com';
    }
  } else {
    console.warn('App exit not supported in current environment');
  }
};

/**
 * Checks if we should intercept back navigation
 */
export const shouldInterceptBackNavigation = (currentPath: string): boolean => {
  // Only intercept if TWA logic should apply to this route
  if (!shouldApplyTWALogic(currentPath)) {
    return false;
  }
  
  // Intercept when navigating back to onboarding or auth from app routes
  const isAppRoute = currentPath.startsWith('/app/') && 
    currentPath !== '/app/onboarding' && 
    currentPath !== '/app/auth';
    
  return isAppRoute;
};

/**
 * Get the history length to determine if we can go back
 */
export const canNavigateBack = (): boolean => {
  return window.history.length > 1;
};
