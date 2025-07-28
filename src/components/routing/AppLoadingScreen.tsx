import React from 'react';

interface AppLoadingScreenProps {
  message?: string;
  isNative?: boolean;
  error?: string | null;
  timeout?: boolean;
}

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({ 
  message,
  isNative = false,
  error = null,
  timeout = false
}) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center space-y-4 max-w-sm mx-auto px-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground text-center">
          {message || (isNative ? 'Starting app...' : 'Loading...')}
        </p>
        {error && (
          <p className="text-xs text-red-500 mt-2 text-center">
            Error: {error}
          </p>
        )}
        {timeout && (
          <p className="text-xs text-yellow-500 mt-2 text-center">
            Taking longer than expected...
          </p>
        )}
        {(error || timeout) && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            The app will continue loading in the background
          </p>
        )}
      </div>
    </div>
  );
};

export default AppLoadingScreen;