import { debounce } from '@/lib/utils';

type FetchOptions = RequestInit & {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
};

/**
 * Enhanced fetch function with retry logic and timeout
 */
export async function fetchWithRetry(
  url: string, 
  options: FetchOptions = {}
): Promise<Response> {
  const { 
    retries = 2,
    retryDelay = 1000, 
    timeout = 15000,
    ...fetchOptions 
  } = options;
  
  // Create an AbortController for the timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    
    // If the response is ok, return it
    if (response.ok) {
      return response;
    }
    
    // If we have retries left and the error is retryable, retry
    if (retries > 0 && isRetryableError(response.status)) {
      // Wait for the specified delay
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      // Retry with one less retry and shorter delay
      return fetchWithRetry(url, {
        ...options,
        retries: retries - 1,
        retryDelay: retryDelay * 1.2,
      });
    }
    
    // If we're out of retries or the error is not retryable, throw
    throw new Error(`Request failed with status ${response.status}`);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeout}ms`);
    }
    
    if (retries > 0 && isNetworkError(error)) {
      // Wait for the specified delay
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      // Retry with one less retry
      return fetchWithRetry(url, {
        ...options,
        retries: retries - 1,
        retryDelay: retryDelay * 1.2,
      });
    }
    
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Determine if an error is a network error
 */
function isNetworkError(error: any): boolean {
  return (
    !navigator.onLine ||
    error instanceof TypeError ||
    error.message.includes('NetworkError') ||
    error.message.includes('Failed to fetch')
  );
}

/**
 * Determine if an error status code is retryable
 */
function isRetryableError(status: number): boolean {
  // 408: Request Timeout
  // 500, 502, 503, 504: Server errors
  return [408, 500, 502, 503, 504].includes(status);
}

/**
 * Create a debounced version of fetchWithRetry for frequent calls
 */
export const debouncedFetch = debounce(fetchWithRetry, 300);