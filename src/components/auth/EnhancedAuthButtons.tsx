import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import * as authService from '@/services/authService';
import { enhancedAuthService } from '@/services/enhancedAuthService';
import { toast } from 'sonner';
import { RefreshCw, Zap, AlertTriangle } from 'lucide-react';

interface EnhancedAuthButtonsProps {
  onAuthSuccess?: () => void;
  onAuthError?: (error: any) => void;
  showRetryOptions?: boolean;
}

export const EnhancedAuthButtons: React.FC<EnhancedAuthButtonsProps> = ({
  onAuthSuccess,
  onAuthError,
  showRetryOptions = true
}) => {
  const [isRetryMode, setIsRetryMode] = useState(false);
  const [authAttempts, setAuthAttempts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [currentError, setCurrentError] = useState('');

  const handleSignIn = async (method: 'google' | 'apple') => {
    try {
      console.log(`[EnhancedAuthButtons] Starting ${method} sign-in`);
      setIsLoading(true);
      setCurrentError('');
      
      if (isRetryMode) {
        // Use enhanced service with retry logic
        await enhancedAuthService.signInWithRetry(method);
      } else {
        // Use standard auth service
        if (method === 'google') {
          await authService.signInWithGoogle();
        } else if (method === 'apple') {
          await authService.signInWithApple();
        }
      }
      
      onAuthSuccess?.();
    } catch (error: any) {
      console.error(`[EnhancedAuthButtons] ${method} sign-in failed:`, error);
      
      // Track attempts
      const currentAttempts = authAttempts[method] || 0;
      setAuthAttempts(prev => ({
        ...prev,
        [method]: currentAttempts + 1
      }));
      
      const errorMessage = error.message || `${method} sign-in failed`;
      setCurrentError(errorMessage);
      onAuthError?.(error);
      
      // Show retry option after first failure
      if (!isRetryMode && showRetryOptions) {
        toast.error(
          `${method === 'google' ? 'Google' : 'Apple'} sign-in failed. Try enhanced retry mode?`,
          {
            action: {
              label: 'Enable Retry Mode',
              onClick: () => setIsRetryMode(true)
            }
          }
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiagnostics = async () => {
    try {
      const results = await enhancedAuthService.runDiagnostics();
      console.log('[EnhancedAuthButtons] Diagnostics results:', results);
      
      if (results.sessionValid && results.profileExists) {
        toast.success('Authentication diagnostics: All systems operational');
      } else {
        toast.warning('Authentication diagnostics: Issues detected - check console for details');
      }
    } catch (error: any) {
      console.error('[EnhancedAuthButtons] Diagnostics failed:', error);
      toast.error('Diagnostics failed - check console for details');
    }
  };

  return (
    <div className="space-y-4">
      {/* Enhanced mode indicator */}
      {isRetryMode && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Zap className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            Enhanced Auth Mode Enabled
          </span>
          <Badge variant="secondary" className="ml-auto">
            Auto-retry
          </Badge>
        </div>
      )}

      {/* Auth buttons */}
      <div className="space-y-3">
        <div className="relative">
          <Button 
            size="lg" 
            className="w-full flex items-center justify-center gap-2"
            onClick={() => handleSignIn('google')}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="animate-spin h-5 w-5 border-t-2 border-white rounded-full mr-2" />
            ) : (
              <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                  <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                  <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                  <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                  <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                </g>
              </svg>
            )}
            Sign in with Google
          </Button>
          {authAttempts.google > 0 && (
            <Badge
              variant="outline"
              className="absolute -top-2 -right-2 text-xs bg-yellow-50 border-yellow-200"
            >
              {authAttempts.google} attempts
            </Badge>
          )}
        </div>

        <div className="relative">
          <Button 
            size="lg" 
            className="w-full flex items-center justify-center gap-2 bg-black text-white hover:bg-gray-800"
            onClick={() => handleSignIn('apple')}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="animate-spin h-5 w-5 border-t-2 border-white rounded-full mr-2" />
            ) : (
              <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M12.017 14.999c-1.45-.074-2.693-1.057-3.115-2.441-.422-1.384.07-2.888 1.221-3.73.65-.475 1.44-.742 2.259-.762 1.45.074 2.693 1.057 3.115 2.441.422 1.384-.07 2.888-1.221 3.73-.65.475-1.44.742-2.259.762zm7.5-1.999c0 5.523-4.477 10-10 10s-10-4.477-10-10 4.477-10 10-10 10 4.477 10 10z"/>
              </svg>
            )}
            Sign in with Apple
          </Button>
          {authAttempts.apple > 0 && (
            <Badge
              variant="outline"
              className="absolute -top-2 -right-2 text-xs bg-yellow-50 border-yellow-200"
            >
              {authAttempts.apple} attempts
            </Badge>
          )}
        </div>
      </div>

      {/* Show current error */}
      {currentError && (
        <div className="text-sm text-red-600 text-center p-2 bg-red-50 rounded">
          {currentError}
        </div>
      )}

      {/* Enhanced controls */}
      <div className="flex flex-col gap-2 pt-4 border-t border-border/50">
        {!isRetryMode && showRetryOptions && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRetryMode(true)}
            className="flex items-center gap-2 text-xs"
          >
            <Zap className="h-3 w-3" />
            Enable Enhanced Auth
          </Button>
        )}
        
        {isRetryMode && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsRetryMode(false)}
            className="flex items-center gap-2 text-xs"
          >
            <RefreshCw className="h-3 w-3" />
            Use Standard Auth
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDiagnostics}
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <AlertTriangle className="h-3 w-3" />
          Run Diagnostics
        </Button>
      </div>

      {/* Attempt summary */}
      {Object.keys(authAttempts).length > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          Total attempts: Google {authAttempts.google || 0}, Apple {authAttempts.apple || 0}
        </div>
      )}
    </div>
  );
};