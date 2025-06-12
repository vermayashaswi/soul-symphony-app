
import React from 'react';

interface EmergencyFallbackProps {
  error?: Error;
  resetError?: () => void;
}

export const EmergencyFallback: React.FC<EmergencyFallbackProps> = ({ 
  error, 
  resetError 
}) => {
  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleGoToApp = () => {
    window.location.href = '/app/auth';
  };

  // Log error details for debugging
  React.useEffect(() => {
    if (error) {
      console.error('[EmergencyFallback] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        currentPath: window.location.pathname,
        timestamp: new Date().toISOString()
      });
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>
          <p className="text-muted-foreground mb-4">
            {error?.message || 'The application encountered an unexpected error.'}
          </p>
          
          {/* Show current path for debugging */}
          <p className="text-xs text-muted-foreground mb-4">
            Current path: {window.location.pathname}
          </p>
        </div>
        
        <div className="space-y-3">
          <button 
            onClick={handleReload}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Reload Page
          </button>
          
          <button 
            onClick={handleGoHome}
            className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
          >
            Go to Homepage
          </button>
          
          <button 
            onClick={handleGoToApp}
            className="w-full px-4 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors"
          >
            Go to App
          </button>
          
          {resetError && (
            <button 
              onClick={resetError}
              className="w-full px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
        
        <div className="mt-6 text-xs text-muted-foreground">
          <p>If this problem persists, please try:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Clearing your browser cache</li>
            <li>Disabling browser extensions</li>
            <li>Using an incognito/private window</li>
            <li>Checking the browser console for errors</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
