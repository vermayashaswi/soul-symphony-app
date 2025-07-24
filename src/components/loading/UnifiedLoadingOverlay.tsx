import React, { useEffect, useState } from 'react';
import { loadingStateManager, LoadingState, LoadingPriority } from '@/services/loadingStateManager';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { appRecoveryService } from '@/services/appRecoveryService';
import { authRecoveryService } from '@/services/authRecoveryService';

export const UnifiedLoadingOverlay: React.FC = () => {
  const [loadingState, setLoadingState] = useState<LoadingState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = loadingStateManager.subscribe((state) => {
      setLoadingState(state);
      setError(null);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (loadingState && loadingState.message.includes('Checking authentication')) {
      // Set timeout for auth checking
      timeoutId = setTimeout(async () => {
        setError('Authentication check is taking longer than expected');
        
        // Try auth recovery first
        const recovered = await authRecoveryService.detectAndRecoverFromAuthLoop();
        
        if (!recovered) {
          toast.error('Authentication timeout. Attempting recovery...');
          await appRecoveryService.triggerRecovery('auth_timeout', {
            clearAuth: true,
            forceNavigation: '/app/onboarding'
          });
        }
      }, 12000); // 12 seconds for auth timeout
    } else if (loadingState) {
      // General timeout for other operations
      timeoutId = setTimeout(() => {
        setError('Operation is taking longer than expected');
        toast.warning('Operation timeout. You can try refreshing or continue waiting.');
      }, 25000); // 25 seconds for general operations
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [loadingState]);

  const handleRetry = async () => {
    setError(null);
    
    // If it's an auth-related loading state, try auth recovery
    if (loadingState?.message.includes('authentication') || loadingState?.message.includes('Checking auth')) {
      toast.info('Attempting authentication recovery...');
      await authRecoveryService.forceAuthRecovery();
    } else {
      loadingStateManager.clearAll();
      toast.info('Clearing loading state...');
    }
  };

  const handleForceRefresh = async () => {
    toast.info('Forcing app recovery...');
    await appRecoveryService.triggerRecovery('user_forced_refresh', {
      clearAuth: false,
      reloadApp: true
    });
  };

  const handleEmergencyReset = async () => {
    toast.info('Performing emergency reset...');
    await appRecoveryService.emergencyRecovery();
  };

  // Don't show loading for LOW priority items or if no loading state
  if (!loadingState || loadingState.priority === LoadingPriority.LOW) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center"
      >
        <div className="flex flex-col items-center space-y-4 max-w-md mx-4">
          {!error ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-muted-foreground text-center">
                {loadingState.message || 'Loading...'}
              </p>
            </>
          ) : (
            <>
              <div className="text-destructive">
                <AlertCircle className="w-12 h-12" />
              </div>
              <div className="text-center">
                <p className="text-destructive font-medium mb-2">
                  Loading Error
                </p>
                <p className="text-muted-foreground text-sm mb-4">
                  {error}
                </p>
              </div>
              
              <div className="flex flex-col gap-2 mt-4">
                <div className="flex gap-2">
                  <Button 
                    onClick={handleRetry}
                    variant="outline"
                    size="sm"
                    className="text-sm"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Recovery
                  </Button>
                  <Button 
                    onClick={handleForceRefresh}
                    variant="secondary"
                    size="sm"
                    className="text-sm"
                  >
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Force Refresh
                  </Button>
                </div>
                {error?.includes('Authentication') && (
                  <Button 
                    onClick={handleEmergencyReset}
                    variant="destructive"
                    size="sm"
                    className="text-xs"
                  >
                    Emergency Reset
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};