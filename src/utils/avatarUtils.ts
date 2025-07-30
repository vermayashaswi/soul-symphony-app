
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
    urlObj.searchParams.set('sz', size.toString());
    
    // Add cache busting and quality parameters for better loading
    urlObj.searchParams.set('c', 'c'); // Center crop
    
    return urlObj.toString();
  } catch (error) {
    console.warn('Failed to optimize Google avatar URL:', error);
    return url;
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
  } catch {
    console.warn('Invalid avatar URL provided:', avatarUrl);
    return undefined;
  }
};

/**
 * Validates if an avatar URL is accessible
 * @param url - The avatar URL to validate
 * @returns Promise<boolean> indicating if the URL is accessible
 */
export const validateAvatarUrl = async (url: string): Promise<boolean> => {
  if (!url) return false;
  
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
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
    
    if (retryCount > 0) {
      // Add cache-busting parameter for retries
      urlObj.searchParams.set('retry', retryCount.toString());
      urlObj.searchParams.set('t', Date.now().toString());
    }
    
    return urlObj.toString();
  } catch {
    return url;
  }
};
