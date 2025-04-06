
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
        
        setThemes(filteredThemes);
      }
      
      // Determine if themes are still loading with safe check for initialThemes
      const noThemes = Array.isArray(initialThemes) ? initialThemes.length === 0 : true;
      const shouldBeLoading = isProcessing || (noThemes && isNew);
      setIsThemesLoading(shouldBeLoading);
      
    } catch (error) {
      console.error('[ThemeLoader] Error setting initial themes:', error);
      setThemes([]);
      setHasError(true);
    }
  }, [initialThemes, isProcessing, isNew, entryId]);

  // Set up polling for themes if needed
  useEffect(() => {
    if (!mountedRef.current) return;
    
    // Clean up previous intervals
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    
    // Reset error state on dependencies change
    setHasError(false);
    
    // If themes are loading and we have an entry ID, poll for themes
    if (isThemesLoading && entryId) {
      let pollAttempts = 0;
      const maxAttempts = 5;
      
      pollIntervalRef.current = setInterval(async () => {
        if (!mountedRef.current) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          return;
        }
        
        pollAttempts++;
        console.log(`[ThemeLoader] Polling for themes for entry ${entryId}, attempt ${pollAttempts}`);
        
        try {
          // Fetch the latest version of the entry
          const { data, error } = await supabase
            .from('Journal Entries')
            .select('master_themes, themes')
            .eq('id', entryId)
            .maybeSingle();
            
          if (error) throw error;
          
          // Check if data exists and is not an error
          if (data && typeof data === 'object') {
            // Use type assertion to safely access properties
            const entryData = data as { master_themes?: string[], themes?: string[] };
            
            // Safely extract themes with fallbacks
            const updatedMasterThemes = Array.isArray(entryData.master_themes) 
              ? entryData.master_themes.filter(t => t && typeof t === 'string' && t.trim() !== '' && t !== '•') 
              : [];
              
            const updatedThemes = Array.isArray(entryData.themes) 
              ? entryData.themes.filter(t => t && typeof t === 'string' && t.trim() !== '' && t !== '•') 
              : [];
              
            const updatedCurrentThemes = updatedMasterThemes.length > 0 ? updatedMasterThemes : updatedThemes;
            
            // If we now have themes, update them and stop loading
            if (updatedCurrentThemes.length > 0) {
              console.log(`[ThemeLoader] Found themes for entry ${entryId}:`, updatedCurrentThemes);
              
              if (mountedRef.current) {
                setThemes(updatedCurrentThemes);
                setIsThemesLoading(false);
                
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
              }
            }
          }
          
          // Stop polling after max attempts
          if (pollAttempts >= maxAttempts) {
            console.log(`[ThemeLoader] Max polling attempts reached for entry ${entryId}`);
            if (mountedRef.current) {
              setIsThemesLoading(false);
              
              // Generate fallback themes if we still don't have any
              if (themes.length === 0 && content) {
                const fallbackThemes = generateFallbackThemes(content);
                if (fallbackThemes.length > 0) {
                  setThemes(fallbackThemes);
                }
              }
            }
            
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        } catch (error) {
          console.error(`[ThemeLoader] Error polling for themes for entry ${entryId}:`, error);
          
          // After multiple retries, stop showing loading state
          if (pollAttempts >= maxAttempts) {
            if (mountedRef.current) {
              setIsThemesLoading(false);
              setHasError(pollAttempts >= 3); // Set error state after multiple failures
              
              // Generate fallback themes if needed
              if (themes.length === 0 && content) {
                const fallbackThemes = generateFallbackThemes(content);
                if (fallbackThemes.length > 0) {
                  setThemes(fallbackThemes);
                }
              }
            }
            
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        }
      }, 3000); // Poll every 3 seconds
      
      // Safety timeout to stop loading state after 15 seconds regardless
      safetyTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setIsThemesLoading(false);
          
          // Fallback themes if we still have none
          if (themes.length === 0 && content) {
            const fallbackThemes = generateFallbackThemes(content);
            if (fallbackThemes.length > 0) {
              setThemes(fallbackThemes);
            }
          }
          
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }, 15000);
      
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
  }, [entryId, isThemesLoading, themes.length, content]);

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
    
    // Trigger a new attempt to fetch themes
    if (entryId && content) {
      setTimeout(() => {
        if (themes.length === 0) {
          const fallbackThemes = generateFallbackThemes(content);
          if (fallbackThemes.length > 0) {
            setThemes(fallbackThemes);
          }
          setIsThemesLoading(false);
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
      {isThemesLoading ? (
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
          isDisturbed={true}
          isLoading={false} 
        />
      )}
    </div>
  );
}

export default ThemeLoader;
