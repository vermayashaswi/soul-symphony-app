
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
  
  const isTWA = 
    window.matchMedia('(display-mode: standalone)').matches ||
    userAgent.includes('wv') ||
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
 * Enhanced navigation interception with authentication awareness
 */
export const shouldInterceptBackNavigation = (currentPath: string, isAuthenticated: boolean): boolean => {
  const twaEnv = detectTWAEnvironment();
  
  // Only intercept in TWA environment
  if (!twaEnv.isTWA && !twaEnv.isStandalone) {
    return false;
  }
  
  console.log('[TWA] Checking back navigation interception:', { currentPath, isAuthenticated });
  
  // For authenticated users
  if (isAuthenticated) {
    // Intercept back navigation from main app routes to show exit confirmation
    const mainAppRoutes = ['/app/home', '/app/journal', '/app/profile', '/app/settings'];
    if (mainAppRoutes.includes(currentPath)) {
      console.log('[TWA] Intercepting from main app route for exit confirmation');
      return true;
    }
    
    // Block navigation back to auth/onboarding when authenticated
    if (currentPath.startsWith('/app/') && 
        currentPath !== '/app/auth' && 
        currentPath !== '/app/onboarding') {
      console.log('[TWA] Preventing back navigation to auth/onboarding during authenticated session');
      return true;
    }
  } else {
    // For unauthenticated users, block going back from auth/onboarding to prevent loops
    if (currentPath === '/app/auth' || currentPath === '/app/onboarding') {
      console.log('[TWA] Blocking back navigation from auth/onboarding for unauthenticated user');
      return true;
    }
  }
  
  return false;
};

/**
 * Update session authentication status
 */
export const updateSessionAuthStatus = (isAuthenticated: boolean, currentPath?: string): void => {
  if (isAuthenticated && currentPath && currentPath.startsWith('/app/')) {
    // User is authenticated in app - maintain or create session state
    const sessionState = getSessionNavigationState();
    
    if (!sessionState || !sessionState.isAuthenticated) {
      // First time auth or re-auth, set entry point
      if (currentPath !== '/app/auth' && currentPath !== '/app/onboarding') {
        setSessionEntryPoint(currentPath);
      }
    } else {
      // Update existing session
      const updatedState = {
        ...sessionState,
        isAuthenticated: true
      };
      localStorage.setItem('twa_session_state', JSON.stringify(updatedState));
    }
  } else if (!isAuthenticated) {
    // User logged out, clear session state
    clearSessionNavigationState();
  }
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
      
      // Fallback: Navigate to a special exit page
      setTimeout(() => {
        window.location.href = 'about:blank';
      }, 100);
      
    } catch (error) {
      console.warn('Could not exit TWA app:', error);
      window.location.href = 'https://google.com';
    }
  } else {
    console.warn('App exit not supported in current environment');
  }
};

/**
 * Get the history length to determine if we can go back
 */
export const canNavigateBack = (): boolean => {
  return window.history.length > 1;
};
