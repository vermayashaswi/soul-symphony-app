import React from 'react';
import { Progress } from '@/components/ui/progress';
import { useAppInitializationContext } from '@/contexts/AppInitializationContext';

export const AppLoadingScreen: React.FC = () => {
  const { progress, currentPhase, error } = useAppInitializationContext();

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center space-y-4 text-center max-w-md">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-semibold text-destructive">Initialization Failed</h2>
          <p className="text-muted-foreground">
            The app failed to initialize properly. Please refresh to try again.
          </p>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32 w-full">
            {error}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Refresh App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-6 text-center max-w-md mx-auto px-6">
        {/* App Logo/Icon */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-primary animate-pulse" />
        </div>
        
        {/* Loading Text */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Loading Soulo</h2>
          <p className="text-muted-foreground">{currentPhase}</p>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full max-w-xs space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">{progress}% complete</p>
        </div>
        
        {/* Loading Animation */}
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};