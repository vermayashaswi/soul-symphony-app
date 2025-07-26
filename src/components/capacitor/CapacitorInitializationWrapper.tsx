import React from 'react';
import { useCapacitorInitialization } from '@/hooks/useCapacitorInitialization';

interface CapacitorInitializationWrapperProps {
  children: React.ReactNode;
}

const CapacitorInitializationWrapper: React.FC<CapacitorInitializationWrapperProps> = ({ children }) => {
  const { isLoading, initializationComplete, isNativeEnvironment, hasTimedOut } = useCapacitorInitialization();

  // Only show loading in native environment and only if still initializing
  if (isNativeEnvironment && isLoading && !initializationComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground text-center">
            {hasTimedOut 
              ? 'Finalizing startup...' 
              : 'Starting Soulo...'
            }
          </p>
          {hasTimedOut && (
            <p className="text-xs text-muted-foreground/70">
              Taking longer than expected...
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default CapacitorInitializationWrapper;