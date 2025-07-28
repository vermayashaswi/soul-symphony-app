import React from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/providers/SessionProvider';

interface SessionLoadingFallbackProps {
  children: React.ReactNode;
}

export const SessionLoadingFallback: React.FC<SessionLoadingFallbackProps> = ({ children }) => {
  const { isInitialized, sessionError, isStuckLoading, retryInitialization } = useSession();

  // Show loading fallback if session is stuck
  if (isStuckLoading || sessionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center space-y-4 text-center max-w-md">
          <div className="text-4xl">
            {isStuckLoading ? '⏳' : '⚠️'}
          </div>
          
          <h2 className="text-xl font-semibold">
            {isStuckLoading ? 'Loading...' : 'Session Error'}
          </h2>
          
          <p className="text-muted-foreground">
            {sessionError || 'The session is taking longer than expected to initialize.'}
          </p>

          <div className="flex flex-col space-y-2 w-full">
            <Button onClick={retryInitialization}>
              Retry Initialization
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>
          </div>
          
          {isStuckLoading && (
            <p className="text-sm text-muted-foreground">
              This usually happens due to network issues or high server load.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Show loading spinner if not yet initialized
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="text-2xl animate-spin">⚪</div>
          <p className="text-muted-foreground">Initializing session...</p>
        </div>
      </div>
    );
  }

  // Show children when session is properly initialized
  return <>{children}</>;
};