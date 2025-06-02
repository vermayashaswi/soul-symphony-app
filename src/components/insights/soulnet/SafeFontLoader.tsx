
import React, { useState, useEffect, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';

interface SafeFontLoaderProps {
  fontUrl: string;
  children: (font: any, isLoading: boolean, hasError: boolean) => React.ReactNode;
  fallbackFont?: string;
  retryCount?: number;
}

export const SafeFontLoader: React.FC<SafeFontLoaderProps> = ({
  fontUrl,
  children,
  fallbackFont = '/fonts/helvetiker_regular.typeface.json',
  retryCount = 3
}) => {
  const [loadState, setLoadState] = useState<{
    font: any;
    isLoading: boolean;
    hasError: boolean;
    currentUrl: string;
    retryAttempt: number;
  }>({
    font: null,
    isLoading: true,
    hasError: false,
    currentUrl: fontUrl,
    retryAttempt: 0
  });

  const mountedRef = useRef(true);
  const loaderRef = useRef<FontLoader>();

  // Create a stable loader instance
  useEffect(() => {
    if (!loaderRef.current) {
      loaderRef.current = new FontLoader();
    }
  }, []);

  // Font loading effect
  useEffect(() => {
    if (!loaderRef.current || !mountedRef.current) return;

    const loadFont = async (url: string, attempt: number = 0) => {
      if (!mountedRef.current) return;

      try {
        setLoadState(prev => ({ 
          ...prev, 
          isLoading: true, 
          hasError: false,
          currentUrl: url,
          retryAttempt: attempt
        }));

        const font = await new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Font loading timeout'));
          }, 5000);

          loaderRef.current!.load(
            url,
            (loadedFont) => {
              clearTimeout(timeout);
              resolve(loadedFont);
            },
            undefined,
            (error) => {
              clearTimeout(timeout);
              reject(error);
            }
          );
        });

        if (mountedRef.current) {
          setLoadState(prev => ({ 
            ...prev, 
            font, 
            isLoading: false, 
            hasError: false 
          }));
          console.log(`[SafeFontLoader] Successfully loaded font: ${url}`);
        }
      } catch (error) {
        console.warn(`[SafeFontLoader] Failed to load font ${url} (attempt ${attempt + 1}):`, error);
        
        if (!mountedRef.current) return;

        // Retry logic
        if (attempt < retryCount && url === fontUrl) {
          setTimeout(() => {
            if (mountedRef.current) {
              loadFont(url, attempt + 1);
            }
          }, 1000 * (attempt + 1));
          return;
        }

        // Fallback to default font if all retries failed and we haven't tried fallback yet
        if (url !== fallbackFont) {
          console.log(`[SafeFontLoader] Falling back to: ${fallbackFont}`);
          loadFont(fallbackFont, 0);
          return;
        }

        // Final error state
        if (mountedRef.current) {
          setLoadState(prev => ({ 
            ...prev, 
            isLoading: false, 
            hasError: true 
          }));
        }
      }
    };

    loadFont(fontUrl);

    return () => {
      mountedRef.current = false;
    };
  }, [fontUrl, fallbackFont, retryCount]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return <>{children(loadState.font, loadState.isLoading, loadState.hasError)}</>;
};

export default SafeFontLoader;
