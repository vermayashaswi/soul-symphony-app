
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
  const location = useLocation();
  const navigate = useNavigate();
  
  const twaEnv = detectTWAEnvironment();

  // Handle popstate events (browser back button)
  const handlePopState = useCallback((event: PopStateEvent) => {
    if (!twaEnv.isTWA && !twaEnv.isStandalone) return;
    
    const currentPath = window.location.pathname;
    
    if (shouldInterceptBackNavigation(currentPath)) {
      // Prevent the navigation
      event.preventDefault();
      
      // Push the current state back to maintain history
      window.history.pushState(null, '', currentPath);
      
      // Check if we can navigate back or should exit
      if (!canNavigateBack() || window.history.length <= 1) {
        setShowExitModal(true);
        options.onExitConfirmation?.();
      } else {
        // Store the attempted navigation
        setInterceptedNavigation(currentPath);
        setShowExitModal(true);
        options.onBackIntercepted?.();
      }
    }
  }, [twaEnv, options]);

  // Handle Android hardware back button
  useEffect(() => {
    if (!twaEnv.isAndroidTWA) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Android back button simulation or actual back key
      if (event.key === 'Escape' || event.keyCode === 27) {
        const currentPath = location.pathname;
        
        if (shouldInterceptBackNavigation(currentPath)) {
          event.preventDefault();
          event.stopPropagation();
          
          if (!canNavigateBack() || window.history.length <= 1) {
            setShowExitModal(true);
            options.onExitConfirmation?.();
          } else {
            setShowExitModal(true);
            options.onBackIntercepted?.();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [location.pathname, twaEnv.isAndroidTWA, options]);

  // Set up popstate listener
  useEffect(() => {
    if (!twaEnv.isTWA && !twaEnv.isStandalone) return;

    // Add a dummy state to the history to intercept back navigation
    const currentPath = location.pathname;
    if (shouldInterceptBackNavigation(currentPath)) {
      window.history.pushState({ intercepted: true }, '', currentPath);
    }

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [location.pathname, handlePopState, twaEnv]);

  const confirmExit = useCallback(() => {
    setShowExitModal(false);
    setInterceptedNavigation(null);
    
    // Exit the TWA app
    exitTWAApp();
  }, []);

  const cancelExit = useCallback(() => {
    setShowExitModal(false);
    setInterceptedNavigation(null);
    
    // Stay on current page by ensuring history state
    const currentPath = location.pathname;
    window.history.replaceState({ intercepted: true }, '', currentPath);
  }, [location.pathname]);

  return {
    showExitModal,
    confirmExit,
    cancelExit,
    isTWAEnvironment: twaEnv.isTWA || twaEnv.isStandalone
  };
};
