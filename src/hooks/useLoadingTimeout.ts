import { useState, useEffect, useCallback } from 'react';

interface LoadingTimeoutOptions {
  timeoutMs?: number;
  onTimeout?: () => void;
  enableDebug?: boolean;
}

export const useLoadingTimeout = (options: LoadingTimeoutOptions = {}) => {
  const {
    timeoutMs = 10000, // 10 second default timeout
    onTimeout,
    enableDebug = false
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [timeoutHandle, setTimeoutHandle] = useState<NodeJS.Timeout | null>(null);

  const log = useCallback((message: string, data?: any) => {
    if (enableDebug) {
      console.log(`[LoadingTimeout] ${message}`, data || '');
    }
  }, [enableDebug]);

  const startLoading = useCallback(() => {
    log('Starting loading with timeout:', timeoutMs);
    setIsLoading(true);
    setHasTimedOut(false);

    // Clear any existing timeout
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    // Set new timeout
    const handle = setTimeout(() => {
      log('Loading timeout reached');
      setHasTimedOut(true);
      setIsLoading(false);
      
      if (onTimeout) {
        onTimeout();
      }
    }, timeoutMs);

    setTimeoutHandle(handle);
  }, [timeoutMs, onTimeout, timeoutHandle, log]);

  const stopLoading = useCallback((success = true) => {
    log('Stopping loading', { success });
    setIsLoading(false);
    
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      setTimeoutHandle(null);
    }

    if (success) {
      setHasTimedOut(false);
    }
  }, [timeoutHandle, log]);

  const resetTimeout = useCallback(() => {
    log('Resetting timeout state');
    setHasTimedOut(false);
    setIsLoading(false);
    
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      setTimeoutHandle(null);
    }
  }, [timeoutHandle, log]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    };
  }, [timeoutHandle]);

  return {
    isLoading,
    hasTimedOut,
    startLoading,
    stopLoading,
    resetTimeout
  };
};