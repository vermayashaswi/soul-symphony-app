
import React, { useState, useEffect, useRef } from 'react';
import { useTWAInitialization } from '@/hooks/useTWAInitialization';
import { useTWAAutoRefresh } from '@/hooks/useTWAAutoRefresh';
import { twaPermissionBootstrap } from '@/services/twaPermissionBootstrap';
import { detectTWAEnvironment } from '@/utils/twaDetection';

interface TWAInitializationWrapperProps {
  children: React.ReactNode;
}

const TWAInitializationWrapper: React.FC<TWAInitializationWrapperProps> = ({ children }) => {
  const { isLoading, initializationComplete, isTWAEnvironment, hasTimedOut } = useTWAInitialization();
  const { isStuckDetected, refreshCount } = useTWAAutoRefresh();
  const [permissionsBootstrapped, setPermissionsBootstrapped] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [delegationCheckComplete, setDelegationCheckComplete] = useState(false);
  const bootstrapAttemptedRef = useRef(false);

  // Check for permission delegation on mount
  useEffect(() => {
    if (!isTWAEnvironment) {
      setDelegationCheckComplete(true);
      return;
    }

    const checkDelegation = async () => {
      try {
        console.log('[TWAInitializationWrapper] Checking permission delegation capabilities');
        
        const twaEnv = detectTWAEnvironment();
        
        if (twaEnv.hasPermissionDelegation) {
          console.log('[TWAInitializationWrapper] Permission delegation detected, setting up enhanced monitoring');
          
          // If we have delegation, we might not need the same bootstrap flow
          // But we still want to ensure permissions are properly set up
        }
        
        setDelegationCheckComplete(true);
      } catch (error) {
        console.error('[TWAInitializationWrapper] Error checking permission delegation:', error);
        setDelegationCheckComplete(true);
      }
    };

    checkDelegation();
  }, [isTWAEnvironment]);

  // Handle permission bootstrap after basic initialization is complete
  useEffect(() => {
    const handlePermissionBootstrap = async () => {
      // Only bootstrap in TWA environment after initialization and delegation check are complete
      if (!isTWAEnvironment || !initializationComplete || !delegationCheckComplete || bootstrapAttemptedRef.current) {
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
  }, [initializationComplete, isTWAEnvironment, delegationCheckComplete]);

  // Show loading if still initializing OR if permissions are being bootstrapped in TWA
  const shouldShowLoading = isTWAEnvironment && 
    (isLoading || !initializationComplete || !delegationCheckComplete || (initializationComplete && delegationCheckComplete && !permissionsBootstrapped));

  if (shouldShowLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground text-center">
            {isBootstrapping
              ? 'Setting up permissions...'
              : !delegationCheckComplete
                ? 'Checking permission capabilities...'
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
          {!delegationCheckComplete && (
            <p className="text-xs text-muted-foreground/70">
              Checking native permission support...
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default TWAInitializationWrapper;
