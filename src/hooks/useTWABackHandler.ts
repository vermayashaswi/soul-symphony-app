
import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { detectTWAEnvironment, shouldInterceptBackNavigation, exitTWAApp, canNavigateBack } from '@/utils/twaDetection';

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
  const [interceptedNavigation, setInterceptedNavigation] = useState<string | null>(null);
  const [isHandlingBackButton, setIsHandlingBackButton] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  const twaEnv = detectTWAEnvironment();

  // Handle popstate events (browser back button) with debouncing
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
      
      // Check if we can navigate back or should exit
      if (!canNavigateBack() || window.history.length <= 1) {
        console.log('[TWA BackHandler] No back history, showing exit modal');
        setShowExitModal(true);
        options.onExitConfirmation?.();
      } else {
        console.log('[TWA BackHandler] Intercepting back navigation');
        setInterceptedNavigation(currentPath);
        setShowExitModal(true);
        options.onBackIntercepted?.();
      }
    }
    
    // Reset handling flag after a delay
    setTimeout(() => {
      setIsHandlingBackButton(false);
    }, 500);
  }, [twaEnv, options, isHandlingBackButton]);

  // Handle Android hardware back button with better detection
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
          
          if (!canNavigateBack() || window.history.length <= 1) {
            console.log('[TWA BackHandler] No back history, showing exit modal');
            setShowExitModal(true);
            options.onExitConfirmation?.();
          } else {
            console.log('[TWA BackHandler] Intercepting hardware back navigation');
            setShowExitModal(true);
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

  // Set up popstate listener with improved state management
  useEffect(() => {
    if (!twaEnv.isTWA && !twaEnv.isStandalone) return;

    // Add a dummy state to the history to intercept back navigation
    const currentPath = location.pathname;
    if (shouldInterceptBackNavigation(currentPath)) {
      console.log('[TWA BackHandler] Setting up interception for path:', currentPath);
      window.history.pushState({ intercepted: true, path: currentPath }, '', currentPath);
    }

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [location.pathname, handlePopState, twaEnv]);

  const confirmExit = useCallback(() => {
    console.log('[TWA BackHandler] User confirmed exit');
    setShowExitModal(false);
    setInterceptedNavigation(null);
    setIsHandlingBackButton(false);
    
    // Exit the TWA app
    setTimeout(() => {
      exitTWAApp();
    }, 100);
  }, []);

  const cancelExit = useCallback(() => {
    console.log('[TWA BackHandler] User cancelled exit');
    setShowExitModal(false);
    setInterceptedNavigation(null);
    setIsHandlingBackButton(false);
    
    // Stay on current page by ensuring history state
    const currentPath = location.pathname;
    window.history.replaceState({ intercepted: true, path: currentPath }, '', currentPath);
  }, [location.pathname]);

  return {
    showExitModal,
    confirmExit,
    cancelExit,
    isTWAEnvironment: twaEnv.isTWA || twaEnv.isStandalone
  };
};
