import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { nativeNavigationService } from '@/services/nativeNavigationService';
import { debugLogger } from '@/utils/debugLogger';
import { sessionStorageManager } from '@/utils/sessionStorage';

interface AuthRedirectFallbackProps {
  onManualRedirect?: () => void;
}

interface FallbackState {
  phase: 'loading' | 'waiting' | 'manual' | 'recovery';
  attempts: number;
  lastError?: string;
}

export const AuthRedirectFallback = ({ onManualRedirect }: AuthRedirectFallbackProps) => {
  const [state, setState] = useState<FallbackState>({ 
    phase: 'loading', 
    attempts: 0 
  });
  const navigationAttempted = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    debugLogger.log('AuthRedirectFallback:Init', {});
    
    // Progressive timeout strategy
    const timeouts = [3000, 5000]; // Show fallback after 3s, then recovery after 5s
    
    const timer1 = setTimeout(() => {
      if (!navigationAttempted.current) {
        debugLogger.log('AuthRedirectFallback:ShowWaiting', {});
        setState(prev => ({ ...prev, phase: 'waiting' }));
      }
    }, timeouts[0]);

    const timer2 = setTimeout(() => {
      if (!navigationAttempted.current) {
        debugLogger.log('AuthRedirectFallback:ShowManual', {});
        setState(prev => ({ ...prev, phase: 'manual' }));
      }
    }, timeouts[1]);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const attemptRecovery = async () => {
    try {
      debugLogger.log('AuthRedirectFallback:Recovery', { 
        additionalData: { attempts: state.attempts } 
      });
      
      setState(prev => ({ 
        ...prev, 
        phase: 'recovery', 
        attempts: prev.attempts + 1 
      }));

      // Clear potentially corrupted session data
      if (state.attempts >= 2) {
        debugLogger.log('AuthRedirectFallback:ClearSession', {});
        sessionStorageManager.clearSession();
      }

      // Attempt navigation with delay to prevent loops
      retryTimeoutRef.current = setTimeout(() => {
        navigationAttempted.current = true;
        if (onManualRedirect) {
          onManualRedirect();
        } else {
          nativeNavigationService.forceReload();
        }
      }, 1000);

    } catch (error) {
      debugLogger.logError('AuthRedirectFallback:RecoveryFailed', error);
      setState(prev => ({ 
        ...prev, 
        phase: 'manual',
        lastError: error instanceof Error ? error.message : 'Recovery failed'
      }));
    }
  };

  const handleManualRedirect = () => {
    debugLogger.log('AuthRedirectFallback:ManualRedirect', {});
    navigationAttempted.current = true;
    
    if (onManualRedirect) {
      onManualRedirect();
    } else {
      nativeNavigationService.forceReload();
    }
  };

  // Loading phase
  if (state.phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Signing you in...</p>
        </div>
      </div>
    );
  }

  // Waiting phase
  if (state.phase === 'waiting') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-pulse rounded-full h-8 w-8 bg-primary/20 mx-auto"></div>
          <p className="text-muted-foreground">Processing authentication...</p>
        </div>
      </div>
    );
  }

  // Recovery phase
  if (state.phase === 'recovery') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
          <p className="text-muted-foreground">
            Attempting recovery... (Try {state.attempts})
          </p>
        </div>
      </div>
    );
  }

  // Manual intervention phase
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-6 max-w-md mx-auto p-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Authentication Complete</h2>
          <p className="text-muted-foreground">
            You've been signed in successfully. Continue to access your journal.
          </p>
          {state.lastError && (
            <div className="text-sm text-orange-600 dark:text-orange-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Recovery needed
            </div>
          )}
        </div>
        
        <div className="space-y-3">
          <Button 
            onClick={handleManualRedirect}
            className="w-full"
            size="lg"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Continue to App
          </Button>
          
          {state.attempts < 3 && (
            <Button 
              onClick={attemptRecovery}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Try Auto-Recovery
            </Button>
          )}
        </div>
        
        {state.attempts > 0 && (
          <p className="text-xs text-muted-foreground">
            Recovery attempts: {state.attempts}
          </p>
        )}
      </div>
    </div>
  );
};