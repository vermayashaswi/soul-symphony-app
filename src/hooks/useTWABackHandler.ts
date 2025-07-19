
import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  detectTWAEnvironment, 
  shouldInterceptBackNavigation, 
  shouldShowExitConfirmation,
  exitTWAApp, 
  updateSessionAuthStatus,
  setSessionEntryPoint
} from '@/utils/twaDetection';
import { useAuth } from '@/contexts/AuthContext';

interface UseTWABackHandlerOptions {
  onExitConfirmation?: () => void;
  onBackIntercepted?: () => void;
}

interface UseTWABackHandlerReturn {
  showExitModal: boolean;
  confirmExit: () => void;
  cancelExit: () => void;
  isTWAEnvironment: boolean;
}

export const useTWABackHandler = (options: UseTWABackHandlerOptions = {}): UseTWABackHandlerReturn => {
  const [showExitModal, setShowExitModal] = useState(false);
  const [isHandlingBackButton, setIsHandlingBackButton] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const twaEnv = detectTWAEnvironment();

  // Update session state when auth status or location changes
  useEffect(() => {
    if (twaEnv.isTWA || twaEnv.isStandalone) {
      updateSessionAuthStatus(!!user, location.pathname);
      
      // Set entry point when user first logs in to an app route
      if (user && location.pathname.startsWith('/app/') && 
          location.pathname !== '/app/auth' && 
          location.pathname !== '/app/onboarding') {
        console.log('[TWA BackHandler] Setting session entry point:', location.pathname);
        setSessionEntryPoint(location.pathname);
      }
    }
  }, [user, location.pathname, twaEnv]);

  // ENHANCED popstate handler with better exit confirmation logic
  const handlePopState = useCallback((event: PopStateEvent) => {
    if (!twaEnv.isTWA && !twaEnv.isStandalone) return;
    if (isHandlingBackButton) return;
    
    setIsHandlingBackButton(true);
    
    const currentPath = window.location.pathname;
    console.log('[TWA BackHandler] Popstate event for path:', currentPath, 'User:', !!user, 'History length:', window.history.length);
    
    if (shouldInterceptBackNavigation(currentPath, !!user)) {
      console.log('[TWA BackHandler] Intercepting back navigation');
      event.preventDefault();
      
      // Push current state back to maintain history
      window.history.pushState({ intercepted: true }, '', currentPath);
      
      // ENHANCED: Use the new shouldShowExitConfirmation logic
      if (shouldShowExitConfirmation(currentPath, !!user)) {
        console.log('[TWA BackHandler] Showing exit confirmation modal');
        setShowExitModal(true);
        options.onExitConfirmation?.();
      } else {
        console.log('[TWA BackHandler] Blocking navigation - user should use proper app navigation');
        options.onBackIntercepted?.();
      }
    }
    
    setTimeout(() => {
      setIsHandlingBackButton(false);
    }, 500);
  }, [twaEnv, options, isHandlingBackButton, user]);

  // ENHANCED Android hardware back button handler
  useEffect(() => {
    if (!twaEnv.isAndroidTWA) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isHandlingBackButton) return;
      
      if (event.key === 'Escape' || event.keyCode === 27) {
        setIsHandlingBackButton(true);
        
        const currentPath = location.pathname;
        console.log('[TWA BackHandler] Hardware back button for path:', currentPath, 'User:', !!user);
        
        if (shouldInterceptBackNavigation(currentPath, !!user)) {
          event.preventDefault();
          event.stopPropagation();
          
          // ENHANCED: Use the new shouldShowExitConfirmation logic
          if (shouldShowExitConfirmation(currentPath, !!user)) {
            console.log('[TWA BackHandler] Hardware back - showing exit confirmation');
            setShowExitModal(true);
            options.onExitConfirmation?.();
          } else {
            console.log('[TWA BackHandler] Blocking hardware back navigation');
            options.onBackIntercepted?.();
          }
        }
        
        setTimeout(() => {
          setIsHandlingBackButton(false);
        }, 500);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [location.pathname, twaEnv.isAndroidTWA, options, isHandlingBackButton, user]);

  // Set up popstate listener
  useEffect(() => {
    if (!twaEnv.isTWA && !twaEnv.isStandalone) return;

    const currentPath = location.pathname;
    if (shouldInterceptBackNavigation(currentPath, !!user)) {
      console.log('[TWA BackHandler] Setting up interception for path:', currentPath);
      window.history.pushState({ 
        intercepted: true, 
        path: currentPath,
        authenticated: !!user 
      }, '', currentPath);
    }

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [location.pathname, handlePopState, twaEnv, user]);

  const confirmExit = useCallback(() => {
    console.log('[TWA BackHandler] User confirmed app exit');
    setShowExitModal(false);
    setIsHandlingBackButton(false);
    
    setTimeout(() => {
      exitTWAApp();
    }, 100);
  }, []);

  const cancelExit = useCallback(() => {
    console.log('[TWA BackHandler] User cancelled app exit');
    setShowExitModal(false);
    setIsHandlingBackButton(false);
    
    const currentPath = location.pathname;
    window.history.replaceState({ 
      intercepted: true, 
      path: currentPath,
      authenticated: !!user 
    }, '', currentPath);
  }, [location.pathname, user]);

  return {
    showExitModal,
    confirmExit,
    cancelExit,
    isTWAEnvironment: twaEnv.isTWA || twaEnv.isStandalone
  };
};
