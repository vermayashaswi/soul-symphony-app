
/**
 * Utility functions for detecting TWA (Trusted Web App) environment
 * and handling TWA-specific behaviors
 */

export interface TWAEnvironment {
  isTWA: boolean;
  isAndroidTWA: boolean;
  isStandalone: boolean;
  canExit: boolean;
}

/**
 * Detects if the app is running in a TWA environment with improved accuracy
 */
export const detectTWAEnvironment = (): TWAEnvironment => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isAndroid = /android/i.test(userAgent);
  
  // More accurate TWA detection - must meet multiple criteria
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  // Check for TWA-specific indicators (more restrictive)
  const hasTWAIndicators = 
    // WebView indicator
    userAgent.includes('wv') ||
    // Android Chrome Custom Tabs with specific patterns
    (isAndroid && userAgent.includes('chrome') && !userAgent.includes('mobile safari') && isStandalone);

  // Only consider it a TWA if it's both standalone AND has TWA indicators
  const isTWA = isStandalone && hasTWAIndicators;
  
  return {
    isTWA,
    isAndroidTWA: isTWA && isAndroid,
    isStandalone,
    canExit: isTWA || isStandalone
  };
};

/**
 * Route-aware TWA detection - only applies TWA logic to app routes
 */
export const shouldApplyTWALogic = (currentPath: string): boolean => {
  const twaEnv = detectTWAEnvironment();
  
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
