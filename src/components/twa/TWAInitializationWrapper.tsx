
import React, { useState } from 'react';
import { useTWAInitialization } from '@/hooks/useTWAInitialization';
import { useTWAAutoRefresh } from '@/hooks/useTWAAutoRefresh';
import { TWAPermissionInitializer } from '@/components/permissions/TWAPermissionInitializer';

interface TWAInitializationWrapperProps {
  children: React.ReactNode;
}

const TWAInitializationWrapper: React.FC<TWAInitializationWrapperProps> = ({ children }) => {
  const { isLoading, initializationComplete, isTWAEnvironment, hasTimedOut } = useTWAInitialization();
  const { isStuckDetected, refreshCount } = useTWAAutoRefresh();
  const [permissionsComplete, setPermissionsComplete] = useState(false);

  const handlePermissionsComplete = () => {
    console.log('[TWAInitializationWrapper] Permissions flow completed');
    setPermissionsComplete(true);
  };

  // Show loading if still initializing OR if permissions aren't complete in TWA
  const shouldShowLoading = isTWAEnvironment && 
    (isLoading || !initializationComplete || !permissionsComplete);

  if (shouldShowLoading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-muted-foreground text-center">
              {!permissionsComplete && initializationComplete
                ? 'Setting up permissions...'
                : isStuckDetected && refreshCount > 0 
                  ? `Refreshing app... (attempt ${refreshCount})`
                  : hasTimedOut 
                    ? 'Finalizing startup...' 
                    : 'Starting Soulo...'
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
        
        {/* Show permission initializer only after basic initialization is complete */}
        {initializationComplete && !permissionsComplete && (
          <TWAPermissionInitializer onComplete={handlePermissionsComplete} />
        )}
      </>
    );
  }

  return <>{children}</>;
};

export default TWAInitializationWrapper;
