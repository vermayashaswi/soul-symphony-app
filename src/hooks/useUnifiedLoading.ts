import { useState, useEffect } from 'react';
import { loadingStateManager, LoadingState } from '@/services/loadingStateManager';

/**
 * Hook to manage unified loading states across the app
 */
export const useUnifiedLoading = () => {
  const [currentLoadingState, setCurrentLoadingState] = useState<LoadingState | null>(null);

  useEffect(() => {
    const unsubscribe = loadingStateManager.subscribe((state) => {
      setCurrentLoadingState(state);
    });

    return unsubscribe;
  }, []);

  return {
    isLoading: currentLoadingState !== null,
    loadingMessage: currentLoadingState?.message || '',
    loadingPriority: currentLoadingState?.priority,
    debugInfo: loadingStateManager.getDebugInfo()
  };
};