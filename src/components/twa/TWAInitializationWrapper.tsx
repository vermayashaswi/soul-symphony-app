
import React, { useEffect } from 'react';
import { useTWAInitialization } from '@/hooks/useTWAInitialization';
import { useTWAAutoRefresh } from '@/hooks/useTWAAutoRefresh';
import { loadingStateManager, LoadingPriority } from '@/services/loadingStateManager';

interface TWAInitializationWrapperProps {
  children: React.ReactNode;
}

const TWAInitializationWrapper: React.FC<TWAInitializationWrapperProps> = ({ children }) => {
  const { isLoading, initializationComplete, isTWAEnvironment, hasTimedOut } = useTWAInitialization();
  const { isStuckDetected, refreshCount } = useTWAAutoRefresh();

  // Register TWA loading state with unified manager
  useEffect(() => {
    if (isTWAEnvironment && isLoading && !initializationComplete) {
      const message = isStuckDetected && refreshCount > 0 
        ? `Refreshing app... (attempt ${refreshCount})`
        : hasTimedOut 
          ? 'Finalizing startup...' 
          : 'Initializing TWA environment...';
      
      loadingStateManager.setLoading('twa-init', LoadingPriority.HIGH, message);
    } else {
      loadingStateManager.clearLoading('twa-init');
    }

    return () => {
      loadingStateManager.clearLoading('twa-init');
    };
  }, [isTWAEnvironment, isLoading, initializationComplete, isStuckDetected, refreshCount, hasTimedOut]);

  return <>{children}</>;
};

export default TWAInitializationWrapper;
