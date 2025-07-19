
/**
 * Utility functions for detecting TWA (Trusted Web App) environment
 * and handling TWA-specific behaviors with session awareness
 */

export interface TWAEnvironment {
  isTWA: boolean;
  isAndroidTWA: boolean;
  isStandalone: boolean;
  canExit: boolean;
}

export interface SessionNavigationState {
  sessionStartPath: string | null;
  sessionStartTime: number;
  isAuthenticated: boolean;
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
 * Set the session entry point when user first authenticates
 */
export const setSessionEntryPoint = (path: string): void => {
  const sessionState: SessionNavigationState = {
    sessionStartPath: path,
    sessionStartTime: Date.now(),
    isAuthenticated: true
  };
  
  localStorage.setItem('twa_session_state', JSON.stringify(sessionState));
  console.log('[TWA] Session entry point set:', path);
};

/**
 * Get the current session navigation state
 */
export const getSessionNavigationState = (): SessionNavigationState | null => {
  try {
    const stored = localStorage.getItem('twa_session_state');
    if (!stored) return null;
    
    const state = JSON.parse(stored) as SessionNavigationState;
    console.log('[TWA] Retrieved session state:', state);
    return state;
  } catch (error) {
    console.error('[TWA] Error getting session state:', error);
    return null;
  }
};

/**
 * Clear session navigation state (on logout)
 */
export const clearSessionNavigationState = (): void => {
  localStorage.removeItem('twa_session_state');
  console.log('[TWA] Session navigation state cleared');
};

/**
 * Check if current path is at the session boundary (should show exit confirmation)
 */
export const isAtSessionBoundary = (currentPath: string): boolean => {
  const sessionState = getSessionNavigationState();
  
  if (!sessionState || !sessionState.isAuthenticated) {
    console.log('[TWA] No active session, not at boundary');
    return false;
  }
  
  // If we're at the session entry point, we're at the boundary
  const atEntryPoint = currentPath === sessionState.sessionStartPath;
  console.log('[TWA] Boundary check:', {
    currentPath,
    sessionStartPath: sessionState.sessionStartPath,
    atEntryPoint
  });
  
  return atEntryPoint;
};

/**
 * Attempts to exit the TWA/PWA app
 */
export const exitTWAApp = (): void => {
  const twaEnv = detectTWAEnvironment();
  
  if (twaEnv.canExit) {
    try {
      console.log('[TWA] Attempting to exit app');
      
      // Clear session state on exit
      clearSessionNavigationState();
      
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
 * Enhanced navigation interception with session awareness
 */
export const shouldInterceptBackNavigation = (currentPath: string): boolean => {
  const twaEnv = detectTWAEnvironment();
  
  // Only intercept in TWA environment
  if (!twaEnv.isTWA && !twaEnv.isStandalone) {
    return false;
  }
  
  const sessionState = getSessionNavigationState();
  
  // If no active session, don't intercept
  if (!sessionState || !sessionState.isAuthenticated) {
    console.log('[TWA] No active session, not intercepting back navigation');
    return false;
  }
  
  // Intercept if we're at the session boundary (entry point)
  if (isAtSessionBoundary(currentPath)) {
    console.log('[TWA] At session boundary, intercepting back navigation for exit confirmation');
    return true;
  }
  
  // Intercept navigation back to onboarding or auth from authenticated app routes
  const isAppRoute = currentPath.startsWith('/app/') && 
    currentPath !== '/app/onboarding' && 
    currentPath !== '/app/auth';
  
  // Prevent going back to onboarding/auth when authenticated
  if (isAppRoute && sessionState.isAuthenticated) {
    console.log('[TWA] Preventing back navigation to auth/onboarding during authenticated session');
    return true;
  }
  
  return false;
};

/**
 * Update session authentication status
 */
export const updateSessionAuthStatus = (isAuthenticated: boolean, currentPath?: string): void => {
  const sessionState = getSessionNavigationState();
  
  if (isAuthenticated && currentPath) {
    // User just authenticated, set or update entry point
    if (!sessionState || !sessionState.isAuthenticated) {
      setSessionEntryPoint(currentPath);
    }
  } else if (!isAuthenticated) {
    // User logged out, clear session state
    clearSessionNavigationState();
  }
};

/**
 * Get the history length to determine if we can go back
 */
export const canNavigateBack = (): boolean => {
  return window.history.length > 1;
};
