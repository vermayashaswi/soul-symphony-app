import React from 'react';
import { useCapacitorInitialization } from '@/hooks/useCapacitorInitialization';

interface CapacitorInitializationWrapperProps {
  children: React.ReactNode;
}

const CapacitorInitializationWrapper: React.FC<CapacitorInitializationWrapperProps> = ({ children }) => {
  const { isLoading, initializationComplete, isNativeEnvironment, hasTimedOut } = useCapacitorInitialization();

  // Enhanced loading state with more context
  if (isNativeEnvironment && isLoading && !initializationComplete) {
    console.log('[CapacitorWrapper] Showing loading screen', { isLoading, initializationComplete, hasTimedOut });
    
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
          
          {/* Emergency bypass for debugging */}
          {hasTimedOut && process.env.NODE_ENV === 'development' && (
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded text-sm"
            >
              Force Restart (Debug)
            </button>
          )}
        </div>
      </div>
    );
  }

  console.log('[CapacitorWrapper] Rendering children', { isNativeEnvironment, isLoading, initializationComplete });
  return <>{children}</>;
};

export default CapacitorInitializationWrapper;