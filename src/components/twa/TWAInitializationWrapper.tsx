
import React from 'react';
import { useTWAInitialization } from '@/hooks/useTWAInitialization';
import { useTWAAutoRefresh } from '@/hooks/useTWAAutoRefresh';

interface TWAInitializationWrapperProps {
  children: React.ReactNode;
}

const TWAInitializationWrapper: React.FC<TWAInitializationWrapperProps> = ({ children }) => {
  const { isLoading, initializationComplete, isTWAEnvironment, hasTimedOut } = useTWAInitialization();
  const { isStuckDetected, refreshCount } = useTWAAutoRefresh();

  // Only show loading in TWA environment and only if still initializing
  if (isTWAEnvironment && isLoading && !initializationComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground text-center">
            {isStuckDetected && refreshCount > 0 
              ? `Refreshing app... (attempt ${refreshCount})`
              : hasTimedOut 
                ? 'Finalizing startup...' 
                : 'Starting Soul Symphony...'
            }
          </p>
          {hasTimedOut && !isStuckDetected && (
            <p className="text-xs text-muted-foreground/70">
              Taking longer than expected...
            </p>
          )}
          {isStuckDetected && (
            <p className="text-xs text-muted-foreground/70">
              Auto-refresh in progress...
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default TWAInitializationWrapper;
