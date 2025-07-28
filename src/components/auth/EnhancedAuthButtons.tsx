import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PlatformAuthButton from '@/components/auth/PlatformAuthButton';
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

  const handleSignIn = async (method: 'google' | 'apple') => {
    try {
      console.log(`[EnhancedAuthButtons] Starting ${method} sign-in`);
      
      if (isRetryMode) {
        // Use enhanced service with retry logic
        await enhancedAuthService.signInWithRetry(method);
      } else {
        // Use standard platform auth button functionality
        return; // Let PlatformAuthButton handle it
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
          <PlatformAuthButton
            platform="google"
            onClick={() => !isRetryMode ? undefined : handleSignIn('google')}
          />
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
          <PlatformAuthButton
            platform="apple"
            onClick={() => !isRetryMode ? undefined : handleSignIn('apple')}
          />
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