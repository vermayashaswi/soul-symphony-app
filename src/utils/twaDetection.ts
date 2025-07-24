
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
 * ENHANCED navigation interception with better home page handling
 */
export const shouldInterceptBackNavigation = (currentPath: string, isAuthenticated: boolean): boolean => {
  const twaEnv = detectTWAEnvironment();
  
  // Only intercept in TWA environment
  if (!twaEnv.isTWA && !twaEnv.isStandalone) {
    return false;
  }
  
  console.log('[TWA] Checking back navigation interception:', { currentPath, isAuthenticated, historyLength: window.history.length });
  
  // For authenticated users
  if (isAuthenticated) {
    // ENHANCED: Always intercept back navigation from home page for exit confirmation
    if (currentPath === '/app/home') {
      console.log('[TWA] Intercepting back navigation from home page for exit confirmation');
      return true;
    }
    
    // Intercept from other main app routes for exit confirmation
    const mainAppRoutes = ['/app/journal', '/app/profile', '/app/settings'];
    if (mainAppRoutes.includes(currentPath)) {
      // Check if we should show exit confirmation based on navigation history
      const sessionState = getSessionNavigationState();
      if (sessionState && sessionState.sessionStartPath === currentPath) {
        console.log('[TWA] Intercepting from session start route for exit confirmation');
        return true;
      }
      
      // For non-starting routes, allow normal back navigation within the app
      console.log('[TWA] Allowing normal back navigation within app routes');
      return false;
    }
    
    // Block navigation back to auth/onboarding when authenticated
    if (currentPath.startsWith('/app/') && 
        currentPath !== '/app/auth' && 
        currentPath !== '/app/onboarding') {
      console.log('[TWA] Standard app route - checking for auth/onboarding prevention');
      return false; // Allow normal navigation within authenticated app
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
 * Check if the current route should show exit confirmation
 */
export const shouldShowExitConfirmation = (currentPath: string, isAuthenticated: boolean): boolean => {
  if (!isAuthenticated) return false;
  
  // Always show exit confirmation from home page
  if (currentPath === '/app/home') {
    return true;
  }
  
  // Show exit confirmation from main routes if they are the session start point
  const mainAppRoutes = ['/app/journal', '/app/profile', '/app/settings'];
  if (mainAppRoutes.includes(currentPath)) {
    const sessionState = getSessionNavigationState();
    return sessionState?.sessionStartPath === currentPath;
  }
  
  return false;
};

/**
 * Update session authentication status
 */
export const updateSessionAuthStatus = (isAuthenticated: boolean, currentPath?: string): void => {
  if (isAuthenticated && currentPath && currentPath.startsWith('/app/')) {
    const sessionState = getSessionNavigationState();
    
    if (!sessionState || !sessionState.isAuthenticated) {
      // First time auth or re-auth, set entry point (but not for auth/onboarding)
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
      
      clearSessionNavigationState();
      
      if (window.close) {
        window.close();
      }
      
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
