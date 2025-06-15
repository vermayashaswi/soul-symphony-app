
import { debounce } from '@/lib/utils';

type FetchOptions = RequestInit & {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  respectRateLimit?: boolean;
};

interface RateLimitResponse {
  error?: string;
  message?: string;
  limitType?: string;
  retryAfter?: number;
}

/**
 * Enhanced fetch function with retry logic, timeout, rate limiting awareness
 */
export async function fetchWithRetry(
  url: string, 
  options: FetchOptions = {}
): Promise<Response> {
  const { 
    retries = 2,
    retryDelay = 1000, 
    timeout = 15000,
    respectRateLimit = true,
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
    
    // Handle rate limiting
    if (response.status === 429 && respectRateLimit) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      console.log(`Rate limited. Retry after ${retryAfter} seconds`);
      
      // For rate limiting, don't retry automatically to respect the limits
      // The calling code should handle this with the rate limit hook
      return response;
    }
    
    // If the response is ok, return it
    if (response.ok) {
      return response;
    }
    
    // If we have retries left and the error is retryable (but not rate limited), retry
    if (retries > 0 && isRetryableError(response.status) && response.status !== 429) {
      console.log(`Retrying request to ${url} (${retries} retries left)`);
      
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
      console.log(`Network error for ${url}, retrying (${retries} retries left)`);
      
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
  // Note: 429 (Too Many Requests) is handled separately
  return [408, 500, 502, 503, 504].includes(status);
}

/**
 * Enhanced utility to check if a response indicates rate limiting
 */
export function isRateLimitResponse(response: Response): boolean {
  return response.status === 429;
}

/**
 * Parse rate limit information from response
 */
export async function parseRateLimitInfo(response: Response): Promise<RateLimitResponse | null> {
  if (!isRateLimitResponse(response)) {
    return null;
  }

  try {
    const data = await response.json();
    return {
      error: data.error,
      message: data.message,
      limitType: data.limitType,
      retryAfter: data.retryAfter || parseInt(response.headers.get('Retry-After') || '60')
    };
  } catch (error) {
    console.warn('Failed to parse rate limit response:', error);
    return {
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: parseInt(response.headers.get('Retry-After') || '60')
    };
  }
}

/**
 * Create a debounced version of fetchWithRetry for frequent calls
 */
export const debouncedFetch = debounce(fetchWithRetry, 300);
