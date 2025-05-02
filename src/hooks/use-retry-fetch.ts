
import { useState, useCallback, useRef } from 'react';

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  backoffFactor?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  onFinal?: () => void;
}

export function useRetryFetch() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<any>(null);
  const [retryCount, setRetryCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const fetchWithRetry = useCallback(async <T>(
    url: string,
    options?: RequestInit,
    retryOptions?: RetryOptions
  ): Promise<T> => {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      backoffFactor = 2,
      onSuccess,
      onError,
      onFinal
    } = retryOptions || {};
    
    setIsLoading(true);
    setError(null);
    
    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    let currentRetry = 0;
    let currentDelay = retryDelay;
    
    const executeRequest = async (): Promise<T> => {
      try {
        const response = await fetch(url, {
          ...options,
          signal,
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const responseData = await response.json();
        setData(responseData);
        setIsLoading(false);
        setRetryCount(0);
        
        if (onSuccess) {
          onSuccess(responseData);
        }
        
        return responseData;
      } catch (err) {
        // Don't retry if the request was aborted
        if ((err as any)?.name === 'AbortError') {
          setIsLoading(false);
          throw err;
        }
        
        if (currentRetry < maxRetries) {
          console.log(`Retry ${currentRetry + 1}/${maxRetries} for ${url}`);
          currentRetry++;
          setRetryCount(currentRetry);
          
          // Wait using exponential backoff
          await new Promise(resolve => setTimeout(resolve, currentDelay));
          currentDelay *= backoffFactor;
          
          // Try again
          return executeRequest();
        } else {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          setIsLoading(false);
          
          if (onError) {
            onError(error);
          }
          
          throw error;
        }
      } finally {
        if (currentRetry === maxRetries) {
          if (onFinal) {
            onFinal();
          }
        }
      }
    };
    
    return executeRequest();
  }, []);
  
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  }, []);
  
  return {
    fetchWithRetry,
    cancelRequest,
    isLoading,
    error,
    data,
    retryCount,
    reset: () => {
      setIsLoading(false);
      setError(null);
      setData(null);
      setRetryCount(0);
    }
  };
}
