import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { useAuth } from '@/contexts/AuthContext';

interface UseCapacitorBackHandlerOptions {
  onExitConfirmation?: () => void;
  onBackIntercepted?: () => void;
}

interface UseCapacitorBackHandlerReturn {
  showExitModal: boolean;
  confirmExit: () => void;
  cancelExit: () => void;
  isNativeEnvironment: boolean;
}

const shouldShowExitConfirmation = (currentPath: string, isAuthenticated: boolean): boolean => {
  if (!isAuthenticated) return false;
  
  // Show exit confirmation from main app routes
  const mainAppRoutes = ['/app/home', '/app/journal', '/app/profile', '/app/settings'];
  return mainAppRoutes.includes(currentPath);
};

export const useCapacitorBackHandler = (
  options: UseCapacitorBackHandlerOptions = {}
): UseCapacitorBackHandlerReturn => {
  const [showExitModal, setShowExitModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { onExitConfirmation, onBackIntercepted } = options;

  const isNativeEnvironment = nativeIntegrationService.isRunningNatively();
  const isAuthenticated = !!user;

  // Handle Android hardware back button
  useEffect(() => {
    if (!isNativeEnvironment) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        
        if (shouldShowExitConfirmation(location.pathname, isAuthenticated)) {
          console.log('[Capacitor] Hardware back button - showing exit confirmation');
          setShowExitModal(true);
          onExitConfirmation?.();
        } else {
          console.log('[Capacitor] Hardware back button - intercepted');
          onBackIntercepted?.();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [location.pathname, isAuthenticated, isNativeEnvironment, onExitConfirmation, onBackIntercepted]);

  // Handle browser back navigation
  const handlePopState = useCallback((event: PopStateEvent) => {
    if (!isNativeEnvironment) return;

    event.preventDefault();
    
    if (shouldShowExitConfirmation(location.pathname, isAuthenticated)) {
      console.log('[Capacitor] Browser back - showing exit confirmation');
      setShowExitModal(true);
      onExitConfirmation?.();
    } else {
      console.log('[Capacitor] Browser back - intercepted');
      onBackIntercepted?.();
    }
  }, [location.pathname, isAuthenticated, isNativeEnvironment, onExitConfirmation, onBackIntercepted]);

  // Set up popstate listener
  useEffect(() => {
    if (!isNativeEnvironment) return;

    // Push a new state to enable back button interception
    window.history.pushState(null, '', window.location.href);
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [handlePopState, isNativeEnvironment]);

  // Confirm app exit
  const confirmExit = useCallback(() => {
    console.log('[Capacitor] User confirmed app exit');
    setShowExitModal(false);
    nativeIntegrationService.exitApp();
  }, []);

  // Cancel app exit
  const cancelExit = useCallback(() => {
    console.log('[Capacitor] User cancelled app exit');
    setShowExitModal(false);
    // Replace the current state to maintain back button interception
    window.history.replaceState(null, '', window.location.href);
  }, []);

  return {
    showExitModal,
    confirmExit,
    cancelExit,
    isNativeEnvironment
  };
};