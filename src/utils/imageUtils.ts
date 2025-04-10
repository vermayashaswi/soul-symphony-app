
import { useEffect, useState } from 'react';

/**
 * Image loading states
 */
export type ImageLoadingState = 'loading' | 'loaded' | 'error';

/**
 * Interface for cached image metadata
 */
interface CachedImage {
  url: string;
  state: ImageLoadingState;
  element?: HTMLImageElement;
  timestamp: number;
}

// In-memory cache for images
const imageCache = new Map<string, CachedImage>();

// Cache expiration time (24 hours in milliseconds)
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

/**
 * Preloads an image and returns its loading state
 * @param url URL of the image to preload
 * @returns Loading state of the image
 */
export const useImagePreloader = (url: string | null): ImageLoadingState => {
  const [loadingState, setLoadingState] = useState<ImageLoadingState>('loading');

  useEffect(() => {
    if (!url) {
      setLoadingState('error');
      return;
    }

    const cachedImage = imageCache.get(url);
    
    // If image is already in cache and not expired
    if (cachedImage && Date.now() - cachedImage.timestamp < CACHE_EXPIRATION) {
      setLoadingState(cachedImage.state);
      return;
    }

    // Initialize cache entry
    imageCache.set(url, {
      url,
      state: 'loading',
      timestamp: Date.now()
    });

    const img = new Image();
    
    img.onload = () => {
      // Update cache and state
      imageCache.set(url, {
        url,
        state: 'loaded',
        element: img,
        timestamp: Date.now()
      });
      setLoadingState('loaded');
    };
    
    img.onerror = () => {
      // Update cache and state for error
      imageCache.set(url, {
        url,
        state: 'error',
        timestamp: Date.now()
      });
      setLoadingState('error');
    };
    
    img.src = url;
    
    // Clean up
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  return loadingState;
};

/**
 * Preloads an array of images
 * @param urls Array of image URLs to preload
 */
export const preloadImages = (urls: string[]): void => {
  urls.forEach(url => {
    if (!imageCache.has(url) || 
        (imageCache.has(url) && 
         Date.now() - imageCache.get(url)!.timestamp >= CACHE_EXPIRATION)) {
      
      const img = new Image();
      
      img.onload = () => {
        imageCache.set(url, {
          url,
          state: 'loaded',
          element: img,
          timestamp: Date.now()
        });
      };
      
      img.onerror = () => {
        imageCache.set(url, {
          url,
          state: 'error',
          timestamp: Date.now()
        });
      };
      
      img.src = url;
    }
  });
};

/**
 * Clears expired images from the cache
 */
export const clearExpiredCache = (): void => {
  const now = Date.now();
  
  imageCache.forEach((value, key) => {
    if (now - value.timestamp >= CACHE_EXPIRATION) {
      imageCache.delete(key);
    }
  });
};
