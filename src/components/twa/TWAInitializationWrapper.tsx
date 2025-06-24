
import React, { useState, useEffect, useRef } from 'react';
import { useTWAInitialization } from '@/hooks/useTWAInitialization';
import { useTWAAutoRefresh } from '@/hooks/useTWAAutoRefresh';
import { twaPermissionBootstrap } from '@/services/twaPermissionBootstrap';

interface TWAInitializationWrapperProps {
  children: React.ReactNode;
}

const TWAInitializationWrapper: React.FC<TWAInitializationWrapperProps> = ({ children }) => {
  const { isLoading, initializationComplete, isTWAEnvironment, hasTimedOut } = useTWAInitialization();
  const { isStuckDetected, refreshCount } = useTWAAutoRefresh();
  const [permissionsBootstrapped, setPermissionsBootstrapped] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const bootstrapAttemptedRef = useRef(false);

  // Handle permission bootstrap after basic initialization is complete
  useEffect(() => {
    const handlePermissionBootstrap = async () => {
      // Only bootstrap in TWA environment after initialization is complete
      if (!isTWAEnvironment || !initializationComplete || bootstrapAttemptedRef.current) {
        return;
      }

      try {
        bootstrapAttemptedRef.current = true;
        console.log('[TWAInitializationWrapper] Starting permission bootstrap');
        
        // Check if bootstrap is needed
        const bootstrapNeeded = await twaPermissionBootstrap.checkBootstrapNeeded();
        
        if (!bootstrapNeeded) {
          console.log('[TWAInitializationWrapper] No permission bootstrap needed');
          setPermissionsBootstrapped(true);
          return;
        }

        setIsBootstrapping(true);
        
        // Add a delay to ensure the app is fully ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Request essential permissions
        const result = await twaPermissionBootstrap.requestEssentialPermissions();
        
        console.log('[TWAInitializationWrapper] Permission bootstrap completed:', result);
        setPermissionsBootstrapped(true);
        
      } catch (error) {
        console.error('[TWAInitializationWrapper] Error during permission bootstrap:', error);
        setPermissionsBootstrapped(true); // Continue even if bootstrap fails
      } finally {
        setIsBootstrapping(false);
      }
    };

    handlePermissionBootstrap();
  }, [initializationComplete, isTWAEnvironment]);

  // Show loading if still initializing OR if permissions are being bootstrapped in TWA
  const shouldShowLoading = isTWAEnvironment && 
    (isLoading || !initializationComplete || (initializationComplete && !permissionsBootstrapped));

  if (shouldShowLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground text-center">
            {isBootstrapping
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
          {isBootstrapping && (
            <p className="text-xs text-muted-foreground/70">
              Requesting app permissions...
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default TWAInitializationWrapper;
