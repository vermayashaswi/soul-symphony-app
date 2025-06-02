
import React, { useState, useEffect, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { localFontService } from '@/services/localFontService';

interface SafeFontLoaderProps {
  fontUrl: string;
  children: (font: any, isLoading: boolean, hasError: boolean) => React.ReactNode;
  fallbackFont?: string;
  retryCount?: number;
  textToValidate?: string; // Add text for validation
}

export const SafeFontLoader: React.FC<SafeFontLoaderProps> = ({
  fontUrl,
  children,
  fallbackFont = '/fonts/helvetiker_regular.typeface.json',
  retryCount = 3,
  textToValidate
}) => {
  const [loadState, setLoadState] = useState<{
    font: any;
    isLoading: boolean;
    hasError: boolean;
    currentUrl: string;
    retryAttempt: number;
    validationPassed: boolean;
  }>({
    font: null,
    isLoading: true,
    hasError: false,
    currentUrl: fontUrl,
    retryAttempt: 0,
    validationPassed: false
  });

  const mountedRef = useRef(true);
  const loaderRef = useRef<FontLoader>();

  // Create a stable loader instance
  useEffect(() => {
    if (!loaderRef.current) {
      loaderRef.current = new FontLoader();
    }
  }, []);

  // Enhanced font loading with validation
  useEffect(() => {
    if (!loaderRef.current || !mountedRef.current) return;

    const loadAndValidateFont = async (url: string, attempt: number = 0) => {
      if (!mountedRef.current) return;

      try {
        console.log(`[SafeFontLoader] Loading font from: ${url} (attempt ${attempt + 1})`);
        
        setLoadState(prev => ({ 
          ...prev, 
          isLoading: true, 
          hasError: false,
          currentUrl: url,
          retryAttempt: attempt,
          validationPassed: false
        }));

        // Load the font
        const font = await new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Font loading timeout'));
          }, 8000); // Increased timeout for better reliability

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

        if (!mountedRef.current) return;

        console.log(`[SafeFontLoader] Font loaded, validating completeness...`);

        // Validate font completeness
        const fontName = url.includes('noto_sans_devanagari') ? 'Noto Sans Devanagari' :
                         url.includes('optimer') ? 'Optimer' : 'Helvetiker';
        
        const validationResult = await localFontService.validateFont(font.data, fontName, textToValidate);

        if (!validationResult.isValid) {
          console.warn(`[SafeFontLoader] Font validation failed for ${url}:`, validationResult.issues);
          throw new Error(`Font validation failed: ${validationResult.issues.join(', ')}`);
        }

        if (textToValidate && !validationResult.supportsScript) {
          console.warn(`[SafeFontLoader] Font does not support required script for text: "${textToValidate}"`);
          throw new Error('Font does not support required script');
        }

        console.log(`[SafeFontLoader] Font validation passed for ${url}`);

        if (mountedRef.current) {
          setLoadState(prev => ({ 
            ...prev, 
            font, 
            isLoading: false, 
            hasError: false,
            validationPassed: true
          }));
          console.log(`[SafeFontLoader] Successfully loaded and validated font: ${url}`);
        }
      } catch (error) {
        console.warn(`[SafeFontLoader] Failed to load/validate font ${url} (attempt ${attempt + 1}):`, error);
        
        if (!mountedRef.current) return;

        // Retry logic
        if (attempt < retryCount && url === fontUrl) {
          console.log(`[SafeFontLoader] Retrying font load in ${1000 * (attempt + 1)}ms...`);
          setTimeout(() => {
            if (mountedRef.current) {
              loadAndValidateFont(url, attempt + 1);
            }
          }, 1000 * (attempt + 1));
          return;
        }

        // Fallback to default font if all retries failed and we haven't tried fallback yet
        if (url !== fallbackFont) {
          console.log(`[SafeFontLoader] Falling back to: ${fallbackFont}`);
          loadAndValidateFont(fallbackFont, 0);
          return;
        }

        // Final error state
        if (mountedRef.current) {
          setLoadState(prev => ({ 
            ...prev, 
            isLoading: false, 
            hasError: true,
            validationPassed: false
          }));
          console.error(`[SafeFontLoader] All font loading attempts failed for: ${fontUrl}`);
        }
      }
    };

    loadAndValidateFont(fontUrl);

    return () => {
      mountedRef.current = false;
    };
  }, [fontUrl, fallbackFont, retryCount, textToValidate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return <>{children(loadState.font, loadState.isLoading, loadState.hasError || !loadState.validationPassed)}</>;
};

export default SafeFontLoader;
