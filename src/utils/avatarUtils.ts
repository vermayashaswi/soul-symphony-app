
/**
 * Enhanced avatar utility functions with retry logic and optimization
 */

/**
 * Detects if a URL is a Google avatar URL
 */
export const isGoogleAvatarUrl = (url: string): boolean => {
  if (!url) return false;
  return url.includes('googleusercontent.com') || url.includes('lh3.googleusercontent.com');
};

/**
 * Optimizes Google avatar URLs by adding size parameters with enhanced error handling
 * @param url - The original avatar URL
 * @param size - The desired size in pixels (default: 192 for high-DPI displays)
 * @returns Optimized URL with size parameter
 */
export const optimizeGoogleAvatarUrl = (url: string, size: number = 192): string => {
  if (!url || !isGoogleAvatarUrl(url)) {
    return url;
  }
  
  try {
    const urlObj = new URL(url);
    
    // Remove existing size parameters that might conflict
    urlObj.searchParams.delete('sz');
    urlObj.searchParams.delete('s');
    urlObj.searchParams.delete('size');
    
    // Add optimized size parameter
    urlObj.searchParams.set('s', size.toString());
    
    // Force high quality and center crop
    urlObj.searchParams.set('c', 'k');
    
    // Add cache-busting parameter for better reliability (but don't be too aggressive)
    const cacheKey = Math.floor(Date.now() / 300000); // Update every 5 minutes
    urlObj.searchParams.set('_cb', cacheKey.toString());
    
    return urlObj.toString();
  } catch (error) {
    console.warn('Failed to optimize Google avatar URL:', error);
    // Return original URL with fallback size parameter
    return url.includes('?') ? `${url}&s=${size}` : `${url}?s=${size}`;
  }
};

/**
 * Gets the optimal avatar URL with size optimization and fallback logic
 * @param avatarUrl - The original avatar URL from user metadata
 * @param size - The desired size in pixels
 * @returns Optimized avatar URL
 */
export const getOptimizedAvatarUrl = (avatarUrl: string | null | undefined, size: number = 192): string | undefined => {
  if (!avatarUrl) return undefined;
  
  // Handle different avatar URL types
  if (isGoogleAvatarUrl(avatarUrl)) {
    return optimizeGoogleAvatarUrl(avatarUrl, size);
  }
  
  // For other URLs, return as-is but validate they're proper URLs
  try {
    new URL(avatarUrl);
    return avatarUrl;
  } catch (error) {
    console.warn('Invalid avatar URL provided:', avatarUrl, error);
    return undefined;
  }
};

/**
 * Validates if an avatar URL is accessible with enhanced error handling
 * @param url - The avatar URL to validate
 * @returns Promise<boolean> indicating if the URL is accessible
 */
export const validateAvatarUrl = async (url: string): Promise<boolean> => {
  if (!url) return false;
  
  try {
    console.log('[avatarUtils] Validating URL:', url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-cache'
    });
    
    clearTimeout(timeoutId);
    const isValid = response.ok;
    console.log('[avatarUtils] URL validation result:', isValid, 'Status:', response.status);
    return isValid;
  } catch (error) {
    console.warn('[avatarUtils] URL validation failed:', error);
    return false;
  }
};

/**
 * Creates avatar URLs with retry logic for failed loads
 * @param url - The original avatar URL
 * @param retryCount - Number of retries attempted
 * @returns Modified URL with retry parameters
 */
export const createRetryAvatarUrl = (url: string, retryCount: number = 0): string => {
  if (!url) return url;
  
  try {
    const urlObj = new URL(url);
    
    // Add retry parameter
    urlObj.searchParams.set('retry', retryCount.toString());
    
    // Add timestamp for cache busting
    urlObj.searchParams.set('t', Date.now().toString());
    
    // For Google avatars, also update the cache-busting parameter
    if (isGoogleAvatarUrl(url)) {
      urlObj.searchParams.set('_cb', Date.now().toString());
    }
    
    return urlObj.toString();
  } catch {
    // If URL parsing fails, append as query string
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}retry=${retryCount}&t=${Date.now()}`;
  }
};
