
/**
 * Utility functions for avatar image optimization
 */

/**
 * Detects if a URL is a Google avatar URL
 */
export const isGoogleAvatarUrl = (url: string): boolean => {
  if (!url) return false;
  return url.includes('googleusercontent.com') || url.includes('lh3.googleusercontent.com');
};

/**
 * Optimizes Google avatar URLs by adding size parameters
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
    
    // Remove existing size parameters
    urlObj.searchParams.delete('sz');
    urlObj.searchParams.delete('s');
    
    // Add optimized size parameter
    urlObj.searchParams.set('sz', size.toString());
    
    return urlObj.toString();
  } catch (error) {
    console.warn('Failed to optimize Google avatar URL:', error);
    return url;
  }
};

/**
 * Gets the optimal avatar URL with size optimization
 * @param avatarUrl - The original avatar URL from user metadata
 * @param size - The desired size in pixels
 * @returns Optimized avatar URL
 */
export const getOptimizedAvatarUrl = (avatarUrl: string | null | undefined, size: number = 192): string | undefined => {
  if (!avatarUrl) return undefined;
  
  if (isGoogleAvatarUrl(avatarUrl)) {
    return optimizeGoogleAvatarUrl(avatarUrl, size);
  }
  
  return avatarUrl;
};
