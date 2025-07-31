import React from 'react';

export interface SessionContextType {
  sessionError?: string | null;
  isStuckLoading?: boolean;
  retryInitialization?: () => void;
}

const SessionLoadingFallback: React.FC<{ sessionError?: string | null; isStuckLoading?: boolean; retryInitialization?: () => void; }> = ({ 
  sessionError, 
  isStuckLoading, 
  retryInitialization 
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading session...</p>
        {sessionError && (
          <div className="mt-4 text-red-500">
            Error: {sessionError}
            {retryInitialization && (
              <button onClick={retryInitialization} className="ml-2 text-primary underline">
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionLoadingFallback;