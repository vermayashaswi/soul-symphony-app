
import React, { useEffect, useState, useRef } from 'react';
import ThemeBoxes from '../ThemeBoxes';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface ThemeLoaderProps {
  entryId: number;
  initialThemes: string[];
  content: string;
  isProcessing?: boolean;
  isNew?: boolean;
}

export function ThemeLoader({ 
  entryId, 
  initialThemes = [], 
  content = "", 
  isProcessing = false, 
  isNew = false 
}: ThemeLoaderProps) {
  const [themes, setThemes] = useState<string[]>([]);
  const [isThemesLoading, setIsThemesLoading] = useState(isProcessing);
  const [themesLoaded, setThemesLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const mountedRef = useRef<boolean>(true);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Log when the component is mounted/unmounted
  useEffect(() => {
    console.log(`[ThemeLoader] Mounted for entry ${entryId}`);
    mountedRef.current = true;
    
    return () => {
      console.log(`[ThemeLoader] Unmounted for entry ${entryId}`);
      mountedRef.current = false;
      
      // Clean up any intervals/timeouts when component unmounts
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    };
  }, [entryId]);

  // Safely initialize themes with extensive defensive checks
  useEffect(() => {
    try {
      // Extra safety check for initialThemes
      if (!Array.isArray(initialThemes)) {
        console.warn(`[ThemeLoader] initialThemes is not an array for entry ${entryId}:`, initialThemes);
        setThemes([]);
      } else {
        // Filter out empty themes or invalid values
        const filteredThemes = initialThemes.filter(theme => 
          theme && typeof theme === 'string' && theme.trim() !== '' && theme !== '•'
        );
        
        if (filteredThemes.length > 0) {
          setThemes(filteredThemes);
          setThemesLoaded(true);
          setIsThemesLoading(false);
        } else {
          setThemes([]);
          // Only set loading if we don't have themes and the entry is new or explicitly processing
          const shouldBeLoading = isProcessing || isNew;
          setIsThemesLoading(shouldBeLoading);
          setThemesLoaded(false);
        }
      }
    } catch (error) {
      console.error('[ThemeLoader] Error setting initial themes:', error);
      setThemes([]);
      setHasError(true);
    }
  }, [initialThemes, isProcessing, isNew, entryId]);

  // Dedicated theme polling mechanism
  useEffect(() => {
    if (!mountedRef.current || !entryId || themesLoaded) return;
    
    // Clean up previous intervals
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    
    // If entry is new or we're explicitly in loading state, set up polling
    if ((isNew || isProcessing) && entryId) {
      console.log(`[ThemeLoader] Setting up theme polling for entry ${entryId}`);
      
      const pollForThemes = async () => {
        if (!mountedRef.current) return;
        
        try {
          console.log(`[ThemeLoader] Polling for themes for entry ${entryId}`);
          
          const { data, error } = await supabase
            .from('Journal Entries')
            .select('master_themes, themes')
            .eq('id', entryId)
            .maybeSingle();
            
          if (error) {
            console.warn(`[ThemeLoader] Error polling for themes: ${error.message}`);
            return;
          }
            
          // Check if data exists and is not an error
          if (data) {
            // Safely extract themes with fallbacks
            const updatedMasterThemes = Array.isArray(data.master_themes) 
              ? data.master_themes.filter(t => t && typeof t === 'string' && t.trim() !== '' && t !== '•') 
              : [];
              
            const updatedThemes = Array.isArray(data.themes) 
              ? data.themes.filter(t => t && typeof t === 'string' && t.trim() !== '' && t !== '•') 
              : [];
              
            const updatedCurrentThemes = updatedMasterThemes.length > 0 ? updatedMasterThemes : updatedThemes;
            
            // If we now have themes, update them and stop loading
            if (updatedCurrentThemes.length > 0 && mountedRef.current) {
              console.log(`[ThemeLoader] Found themes for entry ${entryId}:`, updatedCurrentThemes);
              setThemes(updatedCurrentThemes);
              setIsThemesLoading(false);
              setThemesLoaded(true);
              
              // Stop polling since we found the themes
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
            }
          }
        } catch (err) {
          console.error(`[ThemeLoader] Error in theme polling: ${err}`);
        }
      };
      
      // Initial check immediately
      pollForThemes();
      
      // Then set up interval polling
      pollIntervalRef.current = setInterval(pollForThemes, 3000);
      
      // Safety timeout: after 20 seconds, stop trying and use fallback
      safetyTimeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        
        console.log(`[ThemeLoader] Safety timeout reached for entry ${entryId}`);
        setIsThemesLoading(false);
        
        // If we still don't have themes after timeout, try fallback
        if (themes.length === 0 && content && mountedRef.current) {
          const fallbackThemes = generateFallbackThemes(content);
          if (fallbackThemes.length > 0) {
            console.log(`[ThemeLoader] Using fallback themes for entry ${entryId}`);
            setThemes(fallbackThemes);
            setThemesLoaded(true);
          }
        }
        
        // Clear polling interval
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }, 20000);
      
      // Cleanup on component unmount or deps change
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
      };
    }
  }, [entryId, isNew, isProcessing, themesLoaded, content, themes.length]);

  // Generate fallback themes from content with robust error handling
  const generateFallbackThemes = (text: string): string[] => {
    try {
      if (!text || typeof text !== 'string') return [];
      
      const words = text.split(/\s+/);
      const longWords = words
        .filter(word => word && typeof word === 'string' && word.length > 5)
        .slice(0, 3)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
      
      if (longWords.length > 0) {
        return [...new Set(longWords)]; // Remove duplicates
      }
      return [];
    } catch (error) {
      console.error('[ThemeLoader] Error generating fallback themes:', error);
      return [];
    }
  };

  const handleRetry = () => {
    setHasError(false);
    setRetryCount(prev => prev + 1);
    setIsThemesLoading(true);
    setThemesLoaded(false);
    
    // Trigger a new attempt to fetch themes
    if (entryId && content) {
      setTimeout(() => {
        if (mountedRef.current && themes.length === 0) {
          const fallbackThemes = generateFallbackThemes(content);
          if (fallbackThemes.length > 0) {
            setThemes(fallbackThemes);
          }
          setIsThemesLoading(false);
          setThemesLoaded(true);
        }
      }, 3000);
    }
  };

  // Show an error state with retry button if needed
  if (hasError && themes.length === 0) {
    return (
      <div className="mt-3 md:mt-4">
        <h4 className="text-xs md:text-sm font-semibold text-foreground">Themes</h4>
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
          <p className="text-xs text-red-700 dark:text-red-300">Unable to load themes</p>
          <button 
            onClick={handleRetry}
            className="text-xs mt-1 text-blue-600 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 md:mt-4">
      <h4 className="text-xs md:text-sm font-semibold text-foreground">Themes</h4>
      {isThemesLoading || (!themesLoaded && (isProcessing || isNew)) ? (
        <div className="space-y-2 mt-2">
          <div className="flex space-x-2">
            <Skeleton className="h-6 w-16 rounded-md" />
            <Skeleton className="h-6 w-20 rounded-md" />
          </div>
          <div className="flex space-x-2">
            <Skeleton className="h-6 w-24 rounded-md" />
            <Skeleton className="h-6 w-12 rounded-md" />
          </div>
        </div>
      ) : (
        <ThemeBoxes 
          themes={themes} 
          isDisturbed={themesLoaded} // Only apply animations after themes are confirmed loaded
          isLoading={false} 
        />
      )}
    </div>
  );
}

export default ThemeLoader;
