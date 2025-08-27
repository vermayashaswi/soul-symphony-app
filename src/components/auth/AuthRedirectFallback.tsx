import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Home } from 'lucide-react';
import { nativeNavigationService } from '@/services/nativeNavigationService';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface AuthRedirectFallbackProps {
  onManualRedirect?: () => void;
}

export const AuthRedirectFallback = ({ onManualRedirect }: AuthRedirectFallbackProps) => {
  const [showFallback, setShowFallback] = useState(false);
  const [autoRedirectAttempts, setAutoRedirectAttempts] = useState(0);
  const [isAttemptingRedirect, setIsAttemptingRedirect] = useState(false);

  useEffect(() => {
    // NATIVE APP FIX: Show fallback immediately for native apps, with delay for web
    const isNative = nativeIntegrationService.isRunningNatively();
    const delay = isNative ? 500 : 2000; // Show faster for native apps
    
    const timer = setTimeout(() => {
      setShowFallback(true);
    }, delay);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // NATIVE APP FIX: Auto-attempt redirect for native apps
    if (showFallback && nativeIntegrationService.isRunningNatively() && autoRedirectAttempts < 2) {
      const attemptRedirect = setTimeout(() => {
        console.log('[AuthRedirectFallback] Auto-attempting redirect for native app, attempt:', autoRedirectAttempts + 1);
        setAutoRedirectAttempts(prev => prev + 1);
        setIsAttemptingRedirect(true);
        
        if (onManualRedirect) {
          onManualRedirect();
        } else {
          nativeNavigationService.handleAuthSuccess();
        }
        
        setTimeout(() => setIsAttemptingRedirect(false), 2000);
      }, autoRedirectAttempts === 0 ? 1000 : 3000); // First attempt after 1s, second after 3s

      return () => clearTimeout(attemptRedirect);
    }
  }, [showFallback, autoRedirectAttempts, onManualRedirect]);

  const handleManualRedirect = () => {
    if (onManualRedirect) {
      onManualRedirect();
    } else {
      // Force navigation to home
      nativeNavigationService.forceReload();
    }
  };

  if (!showFallback) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">
            {nativeIntegrationService.isRunningNatively() ? 'Signing you in...' : 'Redirecting...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-6 max-w-md mx-auto p-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">
            {isAttemptingRedirect ? 'Redirecting...' : 'Almost there!'}
          </h2>
          <p className="text-muted-foreground">
            {isAttemptingRedirect ? (
              'Taking you to the app...'
            ) : (
              <>
                You've been signed in successfully. 
                {nativeIntegrationService.isRunningNatively() && autoRedirectAttempts > 0 && (
                  <span className="block mt-2 text-sm">
                    Auto-redirect attempt {autoRedirectAttempts}/2 
                    {autoRedirectAttempts >= 2 && ' - Manual redirect available below'}
                  </span>
                )}
                {!nativeIntegrationService.isRunningNatively() && (
                  <span className="block mt-2">
                    If you're not redirected automatically, you can continue manually.
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        
        {isAttemptingRedirect ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-3">
            <Button 
              onClick={handleManualRedirect}
              className="w-full"
              size="lg"
              disabled={isAttemptingRedirect}
            >
              <Home className="w-4 h-4 mr-2" />
              Go to App
            </Button>
            
            {nativeIntegrationService.isRunningNatively() && autoRedirectAttempts >= 2 && (
              <Button 
                onClick={() => nativeNavigationService.forceReload()}
                variant="outline"
                className="w-full"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Restart App
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};