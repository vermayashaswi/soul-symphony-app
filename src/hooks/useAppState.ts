import { useState, useEffect } from 'react';
import { appStateManager, AppState } from '@/services/appStateManager';

export const useAppState = () => {
  const [state, setState] = useState<AppState>(appStateManager.getState());

  useEffect(() => {
    // Initialize app state manager
    appStateManager.initialize();
    
    // Subscribe to state changes
    const unsubscribe = appStateManager.subscribe(setState);
    
    return unsubscribe;
  }, []);

  return {
    ...state,
    isAuthenticated: appStateManager.isAuthenticated(),
    requiresOnboarding: appStateManager.requiresOnboarding(),
    isPremium: appStateManager.isPremium(),
    signOut: appStateManager.signOut.bind(appStateManager),
    refreshProfile: appStateManager.refreshProfile.bind(appStateManager)
  };
};