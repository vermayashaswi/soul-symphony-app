import React from 'react';
import { Button } from '@/components/ui/button';
import { useNativeSessionManager } from '@/hooks/useNativeSessionManager';

interface NativeSessionFallbackProps {
  children: React.ReactNode;
}

/**
 * Simplified session fallback component specifically for native apps
 * Provides better loading states and error handling for Capacitor WebView
 */
export const NativeSessionFallback: React.FC<NativeSessionFallbackProps> = ({ children }) => {
  const { isLoading, isInitialized, error, refreshSession, isNative } = useNativeSessionManager();

  // Only handle loading states for native apps
  if (!isNative) {
    return <>{children}</>;
  }

  // Show error state with retry option
  if (error && isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center space-y-4 text-center max-w-md">
          <div className="text-4xl">⚠️</div>
          
          <h2 className="text-xl font-semibold">Connection Issue</h2>
          
          <p className="text-muted-foreground">
            Unable to load your session. This might be due to a network issue.
          </p>

          <div className="flex flex-col space-y-2 w-full">
            <Button onClick={refreshSession} disabled={isLoading}>
              {isLoading ? 'Retrying...' : 'Retry'}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              Restart App
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">
            If this persists, try restarting the app.
          </p>
        </div>
      </div>
    );
  }

  // Show loading state for native apps
  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="text-2xl animate-pulse">🎵</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading Soul Symphony...</p>
          <p className="text-sm text-muted-foreground/70">Initializing your session</p>
        </div>
      </div>
    );
  }

  // Session is ready, render children
  return <>{children}</>;
};