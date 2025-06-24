
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
 * Detects if the app is running in a TWA environment
 */
export const detectTWAEnvironment = (): TWAEnvironment => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isAndroid = /android/i.test(userAgent);
  
  // Check for TWA indicators
  const isTWA = 
    // Check if running in standalone mode (PWA/TWA)
    window.matchMedia('(display-mode: standalone)').matches ||
    // Check for TWA specific user agent patterns
    userAgent.includes('wv') || // WebView indicator
    // Check for Android Chrome Custom Tabs
    (isAndroid && userAgent.includes('chrome') && !userAgent.includes('mobile safari'));

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  return {
    isTWA,
    isAndroidTWA: isTWA && isAndroid,
    isStandalone,
    canExit: isTWA || isStandalone
  };
};

/**
 * Attempts to exit the TWA/PWA app
 */
export const exitTWAApp = (): void => {
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
  const twaEnv = detectTWAEnvironment();
  
  // Only intercept in TWA environment
  if (!twaEnv.isTWA && !twaEnv.isStandalone) {
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
