import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ErrorRecoveryState {
  isRecovering: boolean;
  errorCount: number;
  lastErrorTime: number;
  recoveryAttempts: number;
}

interface UseEnhancedErrorRecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onRecoveryStart?: () => void;
  onRecoverySuccess?: () => void;
  onRecoveryFailed?: () => void;
}

export function useEnhancedErrorRecovery({
  maxRetries = 3,
  retryDelay = 2000,
  onRecoveryStart,
  onRecoverySuccess,
  onRecoveryFailed
}: UseEnhancedErrorRecoveryOptions = {}) {
  const { toast } = useToast();
  const [recoveryState, setRecoveryState] = useState<ErrorRecoveryState>({
    isRecovering: false,
    errorCount: 0,
    lastErrorTime: 0,
    recoveryAttempts: 0
  });

  const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const shouldAttemptRecovery = useCallback((error: any): boolean => {
    const errorMessage = error?.message || error?.toString() || '';
    const currentTime = Date.now();
    
    // Don't retry if we've exceeded max retries
    if (recoveryState.recoveryAttempts >= maxRetries) {
      return false;
    }
    
    // Don't retry if last error was very recent (< 1 second)
    if (currentTime - recoveryState.lastErrorTime < 1000) {
      return false;
    }
    
    // Retry for network errors, timeouts, or real-time connection issues
    const retryableErrors = [
      'network',
      'timeout',
      'websocket',
      'connection',
      'failed to fetch',
      'real-time',
      'subscription'
    ];
    
    return retryableErrors.some(pattern => 
      errorMessage.toLowerCase().includes(pattern)
    );
  }, [recoveryState.recoveryAttempts, recoveryState.lastErrorTime, maxRetries]);

  const startRecovery = useCallback(async (
    recoveryAction: () => Promise<void>,
    errorMessage?: string
  ) => {
    if (recoveryState.isRecovering) {
      console.log('[ErrorRecovery] Recovery already in progress, skipping');
      return;
    }

    console.log('[ErrorRecovery] Starting recovery process...');
    
    setRecoveryState(prev => ({
      ...prev,
      isRecovering: true,
      recoveryAttempts: prev.recoveryAttempts + 1,
      lastErrorTime: Date.now()
    }));

    onRecoveryStart?.();

    // Show user-friendly recovery message
    toast({
      title: "Something went wrong, app will try to recover",
      description: "Attempting to restore connection...",
      duration: 3000,
    });

    try {
      // Clear any existing recovery timeout
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
      }

      // Wait for the specified delay before attempting recovery
      await new Promise(resolve => {
        recoveryTimeoutRef.current = setTimeout(resolve, retryDelay);
      });

      // Attempt recovery
      await recoveryAction();

      // Recovery successful
      console.log('[ErrorRecovery] Recovery successful');
      setRecoveryState(prev => ({
        ...prev,
        isRecovering: false,
        errorCount: 0,
        recoveryAttempts: 0
      }));

      onRecoverySuccess?.();
      
      toast({
        title: "Connection restored",
        description: "Successfully recovered from the error",
        duration: 2000,
      });

    } catch (recoveryError) {
      console.error('[ErrorRecovery] Recovery failed:', recoveryError);
      
      setRecoveryState(prev => ({
        ...prev,
        isRecovering: false,
        errorCount: prev.errorCount + 1
      }));

      if (recoveryState.recoveryAttempts >= maxRetries) {
        onRecoveryFailed?.();
        
        toast({
          title: "Recovery failed",
          description: "Please refresh the page to continue",
          variant: "destructive",
          duration: 5000,
        });
      } else {
        // Exponential backoff for next attempt
        const nextDelay = retryDelay * Math.pow(2, recoveryState.recoveryAttempts);
        console.log(`[ErrorRecovery] Will retry in ${nextDelay}ms`);
        
        setTimeout(() => {
          startRecovery(recoveryAction, errorMessage);
        }, nextDelay);
      }
    }
  }, [
    recoveryState.isRecovering,
    recoveryState.recoveryAttempts,
    retryDelay,
    maxRetries,
    onRecoveryStart,
    onRecoverySuccess,
    onRecoveryFailed,
    toast
  ]);

  const handleError = useCallback(async (
    error: any,
    recoveryAction: () => Promise<void>
  ) => {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    
    console.error('[ErrorRecovery] Error occurred:', errorMessage);
    
    setRecoveryState(prev => ({
      ...prev,
      errorCount: prev.errorCount + 1,
      lastErrorTime: Date.now()
    }));

    if (shouldAttemptRecovery(error)) {
      await startRecovery(recoveryAction, errorMessage);
    } else {
      console.log('[ErrorRecovery] Error not retryable or max retries exceeded');
      
      toast({
        title: "Error occurred",
        description: errorMessage,
        variant: "destructive",
        duration: 4000,
      });
    }
  }, [shouldAttemptRecovery, startRecovery, toast]);

  const resetRecoveryState = useCallback(() => {
    console.log('[ErrorRecovery] Resetting recovery state');
    
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }
    
    setRecoveryState({
      isRecovering: false,
      errorCount: 0,
      lastErrorTime: 0,
      recoveryAttempts: 0
    });
  }, []);

  return {
    ...recoveryState,
    handleError,
    startRecovery,
    resetRecoveryState,
    shouldAttemptRecovery
  };
}