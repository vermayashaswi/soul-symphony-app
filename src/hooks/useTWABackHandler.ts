
import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  detectTWAEnvironment, 
  shouldInterceptBackNavigation, 
  exitTWAApp, 
  canNavigateBack,
  isAtSessionBoundary,
  updateSessionAuthStatus,
  getSessionNavigationState
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

  // Update session state when auth status changes
  useEffect(() => {
    if (twaEnv.isTWA || twaEnv.isStandalone) {
      updateSessionAuthStatus(!!user, location.pathname);
    }
  }, [user, location.pathname, twaEnv]);

  // Handle popstate events (browser back button) with session awareness
  const handlePopState = useCallback((event: PopStateEvent) => {
    if (!twaEnv.isTWA && !twaEnv.isStandalone) return;
    if (isHandlingBackButton) return; // Prevent multiple triggers
    
    setIsHandlingBackButton(true);
    
    const currentPath = window.location.pathname;
    console.log('[TWA BackHandler] Popstate event for path:', currentPath);
    
    if (shouldInterceptBackNavigation(currentPath)) {
      // Prevent the navigation
      event.preventDefault();
      
      // Push the current state back to maintain history
      window.history.pushState({ intercepted: true }, '', currentPath);
      
      // Check if we're at session boundary (should exit) or just blocking navigation
      if (isAtSessionBoundary(currentPath)) {
        console.log('[TWA BackHandler] At session boundary - showing exit confirmation');
        setShowExitModal(true);
        options.onExitConfirmation?.();
      } else {
        console.log('[TWA BackHandler] Blocking navigation back to auth/onboarding');
        // Don't show exit modal, just block the navigation
        // User should use proper navigation within the app
        options.onBackIntercepted?.();
      }
    }
    
    // Reset handling flag after a delay
    setTimeout(() => {
      setIsHandlingBackButton(false);
    }, 500);
  }, [twaEnv, options, isHandlingBackButton]);

  // Handle Android hardware back button with session awareness
  useEffect(() => {
    if (!twaEnv.isAndroidTWA) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isHandlingBackButton) return;
      
      // Android back button simulation or actual back key
      if (event.key === 'Escape' || event.keyCode === 27) {
        setIsHandlingBackButton(true);
        
        const currentPath = location.pathname;
        console.log('[TWA BackHandler] Hardware back button for path:', currentPath);
        
        if (shouldInterceptBackNavigation(currentPath)) {
          event.preventDefault();
          event.stopPropagation();
          
          if (isAtSessionBoundary(currentPath)) {
            console.log('[TWA BackHandler] Hardware back at session boundary - showing exit confirmation');
            setShowExitModal(true);
            options.onExitConfirmation?.();
          } else {
            console.log('[TWA BackHandler] Blocking hardware back navigation');
            options.onBackIntercepted?.();
          }
        }
        
        // Reset handling flag after a delay
        setTimeout(() => {
          setIsHandlingBackButton(false);
        }, 500);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [location.pathname, twaEnv.isAndroidTWA, options, isHandlingBackButton]);

  // Set up popstate listener with session-aware state management
  useEffect(() => {
    if (!twaEnv.isTWA && !twaEnv.isStandalone) return;

    // Add a dummy state to the history for navigation control
    const currentPath = location.pathname;
    if (shouldInterceptBackNavigation(currentPath)) {
      console.log('[TWA BackHandler] Setting up session-aware interception for path:', currentPath);
      window.history.pushState({ 
        intercepted: true, 
        path: currentPath,
        sessionAware: true 
      }, '', currentPath);
    }

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [location.pathname, handlePopState, twaEnv]);

  const confirmExit = useCallback(() => {
    console.log('[TWA BackHandler] User confirmed app exit');
    setShowExitModal(false);
    setIsHandlingBackButton(false);
    
    // Exit the TWA app
    setTimeout(() => {
      exitTWAApp();
    }, 100);
  }, []);

  const cancelExit = useCallback(() => {
    console.log('[TWA BackHandler] User cancelled app exit');
    setShowExitModal(false);
    setIsHandlingBackButton(false);
    
    // Stay on current page by ensuring history state
    const currentPath = location.pathname;
    window.history.replaceState({ 
      intercepted: true, 
      path: currentPath,
      sessionAware: true 
    }, '', currentPath);
  }, [location.pathname]);

  return {
    showExitModal,
    confirmExit,
    cancelExit,
    isTWAEnvironment: twaEnv.isTWA || twaEnv.isStandalone
  };
};
