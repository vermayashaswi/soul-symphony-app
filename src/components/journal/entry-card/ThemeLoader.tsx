
import React, { useEffect, useState, useRef } from 'react';
import ThemeBoxes from '../ThemeBoxes';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { triggerThemeExtraction } from '@/utils/audio/theme-extractor';

interface ThemeLoaderProps {
  entryId: number;
  initialThemes: string[];
  content: string;
  isProcessing?: boolean;
  isNew?: boolean;
}

// Define a type for the Journal Entry data structure
interface JournalEntry {
  id: number;
  master_themes?: string[];
  themes?: string[];
  created_at?: string;
  [key: string]: any; // Allow for additional properties
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
  const [stableThemes, setStableThemes] = useState<string[]>([]);
  const [hasFoundThemes, setHasFoundThemes] = useState(false);
  const mountedRef = useRef<boolean>(true);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const themeUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialFetchRef = useRef<boolean>(false);

  // Log when the component is mounted/unmounted
  useEffect(() => {
    console.log(`[ThemeLoader] Mounted for entry ${entryId}`);
    mountedRef.current = true;
    
    // Add an immediate fetch when component mounts if we have initialThemes
    if (initialThemes && initialThemes.length > 0) {
      setThemes(initialThemes);
      setStableThemes(initialThemes);
      setThemesLoaded(true);
      setHasFoundThemes(true);
      setIsThemesLoading(false);
      
      // Dispatch an event to notify that we have themes
      window.dispatchEvent(new CustomEvent('themesUpdated', { 
        detail: { entryId, themes: initialThemes }
      }));
    } else if (entryId && !isProcessing) {
      // Trigger a theme extraction immediately if we don't have themes
      fetchThemesImmediately();
    }
    
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
      
      if (themeUpdateTimeoutRef.current) {
        clearTimeout(themeUpdateTimeoutRef.current);
        themeUpdateTimeoutRef.current = null;
      }
    };
  }, [entryId, initialThemes]);

  // Function to immediately try to fetch themes
  const fetchThemesImmediately = async () => {
    if (!entryId || initialFetchRef.current) return;
    
    initialFetchRef.current = true;
    console.log(`[ThemeLoader] Immediate fetch attempt for entry ${entryId}`);
    
    try {
      const { data, error } = await supabase
        .from('Journal Entries')
        .select('master_themes, themes')
        .eq('id', entryId)
        .maybeSingle();
        
      if (error) {
        console.warn(`[ThemeLoader] Error in immediate fetch: ${error.message}`);
        // If we fail to fetch, trigger extraction
        triggerThemeExtraction(entryId)
          .then(success => {
            console.log(`[ThemeLoader] Theme extraction triggered: ${success}`);
            // Start polling immediately after triggering extraction
            startPollingForThemes();
          })
          .catch(err => console.error('[ThemeLoader] Error triggering theme extraction:', err));
        return;
      }
      
      if (data && typeof data === 'object') {
        const entryData = data as JournalEntry;
        
        // Safely extract themes with fallbacks
        const updatedMasterThemes = Array.isArray(entryData.master_themes)
          ? entryData.master_themes.filter(t => t && typeof t === 'string' && t.trim() !== '' && t !== '•') 
          : [];
          
        const updatedThemes = Array.isArray(entryData.themes)
          ? entryData.themes.filter(t => t && typeof t === 'string' && t.trim() !== '' && t !== '•') 
          : [];
          
        const updatedCurrentThemes = updatedMasterThemes.length > 0 ? updatedMasterThemes : updatedThemes;
        
        if (updatedCurrentThemes.length > 0 && mountedRef.current) {
          console.log(`[ThemeLoader] Immediate fetch found themes for entry ${entryId}:`, updatedCurrentThemes);
          setStableThemes(updatedCurrentThemes);
          setThemes(updatedCurrentThemes);
          setThemesLoaded(true);
          setIsThemesLoading(false);
          setHasFoundThemes(true);
          
          // Dispatch an event to notify that we updated themes
          window.dispatchEvent(new CustomEvent('themesUpdated', { 
            detail: { entryId, themes: updatedCurrentThemes }
          }));
          return;
        }
      }
      
      // If we get here, we didn't find any themes, so trigger an extraction
      triggerThemeExtraction(entryId)
        .then(success => {
          console.log(`[ThemeLoader] Theme extraction triggered: ${success}`);
          // Start polling immediately after triggering extraction
          startPollingForThemes();
        })
        .catch(err => console.error('[ThemeLoader] Error triggering theme extraction:', err));
      
    } catch (err) {
      console.error(`[ThemeLoader] Error in immediate theme fetch: ${err}`);
    }
  };

  // New function to encapsulate polling logic for better readability
  const startPollingForThemes = () => {
    if (!mountedRef.current || !entryId) return;
    
    // Clean up previous intervals
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    console.log(`[ThemeLoader] Starting theme polling for entry ${entryId}`);
    setIsThemesLoading(true);
    
    // Initial check immediately
    pollForThemes();
    
    // Then set up interval polling - more frequent polling (1s instead of 2s)
    pollIntervalRef.current = setInterval(pollForThemes, 1000); // Poll every 1 second instead of 2
    
    // Safety timeout: after 15 seconds (reduced from 20), stop trying and use fallback
    safetyTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      
      console.log(`[ThemeLoader] Safety timeout reached for entry ${entryId}`);
      
      // If we still don't have themes after timeout, try fallback
      if (themes.length === 0 && content && mountedRef.current) {
        const fallbackThemes = generateFallbackThemes(content);
        if (fallbackThemes.length > 0) {
          console.log(`[ThemeLoader] Using fallback themes for entry ${entryId}`);
          setStableThemes(fallbackThemes);
          setThemes(fallbackThemes);
          setThemesLoaded(true);
          
          // Dispatch theme update event with fallback themes
          window.dispatchEvent(new CustomEvent('themesUpdated', { 
            detail: { entryId, themes: fallbackThemes, isFallback: true }
          }));
        }
      }
      
      // Always ensure we stop showing the loading state
      setIsThemesLoading(false);
      
      // Clear polling interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }, 15000); // Reduced from 20000 to 15000 for faster feedback
  };

  // Poll for themes function
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
        
      // Check if data exists and is not an error with additional null checks and type casting
      if (data && typeof data === 'object') {
        const entryData = data as JournalEntry;
        
        // Safely extract themes with fallbacks using the typed interface
        const updatedMasterThemes = Array.isArray(entryData.master_themes)
          ? entryData.master_themes.filter(t => t && typeof t === 'string' && t.trim() !== '' && t !== '•') 
          : [];
          
        const updatedThemes = Array.isArray(entryData.themes)
          ? entryData.themes.filter(t => t && typeof t === 'string' && t.trim() !== '' && t !== '•') 
          : [];
          
        const updatedCurrentThemes = updatedMasterThemes.length > 0 ? updatedMasterThemes : updatedThemes;
        
        // If we now have themes, update them and stop loading
        if (updatedCurrentThemes.length > 0 && mountedRef.current) {
          console.log(`[ThemeLoader] Found themes for entry ${entryId}:`, updatedCurrentThemes);
          
          // Critical fix for theme flickering: Set both stable and displayed themes immediately
          setStableThemes(updatedCurrentThemes);
          setHasFoundThemes(true);
          setThemes(updatedCurrentThemes);
          setIsThemesLoading(false);
          setThemesLoaded(true);
          
          // Dispatch an event to notify that we updated themes
          window.dispatchEvent(new CustomEvent('themesUpdated', { 
            detail: { entryId, themes: updatedCurrentThemes }
          }));
          
          // Stop polling since we found the themes
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          
          // Also clear safety timeout as we succeeded
          if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
          }
        } else if (!isProcessing && mountedRef.current && entryId) {
          // If we don't have themes yet and we're not processing, try triggering theme extraction
          console.log(`[ThemeLoader] No themes found yet, triggering extraction for entry ${entryId}`);
          try {
            await triggerThemeExtraction(entryId);
          } catch (err) {
            console.error('[ThemeLoader] Error triggering theme extraction:', err);
          }
        }
      }
    } catch (err) {
      console.error(`[ThemeLoader] Error in theme polling: ${err}`);
    }
  };

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
          // Set themes immediately without delay to fix flickering
          setThemes(filteredThemes);
          setStableThemes(filteredThemes);
          setThemesLoaded(true);
          setIsThemesLoading(false);
          setHasFoundThemes(true);
          
          // Dispatch an event to notify that we updated themes
          window.dispatchEvent(new CustomEvent('themesUpdated', { 
            detail: { entryId, themes: filteredThemes }
          }));
        } else {
          setThemes([]);
          // Only set loading if we don't have themes and the entry is new or explicitly processing
          const shouldBeLoading = isProcessing || isNew;
          setIsThemesLoading(shouldBeLoading);
          setThemesLoaded(false);
          
          // If we're not in a loading state and have no themes, and the entry is not new or processing,
          // we should try to fetch themes immediately
          if (!shouldBeLoading && entryId && !initialFetchRef.current) {
            console.log(`[ThemeLoader] No initial themes, setting up immediate poll for entry ${entryId}`);
            fetchThemesImmediately();
          }
        }
      }
    } catch (error) {
      console.error('[ThemeLoader] Error setting initial themes:', error);
      setThemes([]);
      setHasError(true);
    }
  }, [initialThemes, isProcessing, isNew, entryId]);

  // Dedicated theme polling mechanism with improved error handling and retry logic
  useEffect(() => {
    if (!mountedRef.current || !entryId) return;
    
    // Critical fix for theme flickering: If we already have stable themes, don't start polling
    if (stableThemes.length > 0 && hasFoundThemes) {
      console.log(`[ThemeLoader] Already have stable themes for entry ${entryId}, skipping polling`);
      return;
    }
    
    // If we already have themes and they're loaded, don't poll
    if (themes.length > 0 && themesLoaded && !isProcessing) {
      console.log(`[ThemeLoader] Already have themes for entry ${entryId}, skipping polling`);
      return;
    }
    
    // Start polling if conditions are met
    startPollingForThemes();
    
    // Listen for content ready events
    const handleContentReady = () => {
      if (!hasFoundThemes && entryId) {
        console.log(`[ThemeLoader] Content ready event received, triggering theme extraction for entry ${entryId}`);
        fetchThemesImmediately();
      }
    };
    
    window.addEventListener('entryContentReady', handleContentReady);
    
    return () => {
      window.removeEventListener('entryContentReady', handleContentReady);
      
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      
      if (themeUpdateTimeoutRef.current) {
        clearTimeout(themeUpdateTimeoutRef.current);
        themeUpdateTimeoutRef.current = null;
      }
    };
  }, [entryId, isNew, isProcessing, themesLoaded, content, themes.length, stableThemes.length, hasFoundThemes]);

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
    if (entryId) {
      triggerThemeExtraction(entryId)
        .then(success => {
          console.log(`[ThemeLoader] Retry theme extraction triggered: ${success}`);
          startPollingForThemes();
        })
        .catch(err => console.error('[ThemeLoader] Error triggering theme extraction on retry:', err));
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

  // Render either the stable themes (if we have them) or loading state, but avoid toggling back and forth
  const shouldShowLoadingState = isThemesLoading && (!hasFoundThemes || stableThemes.length === 0);

  return (
    <div className="mt-3 md:mt-4">
      <h4 className="text-xs md:text-sm font-semibold text-foreground">Themes</h4>
      {shouldShowLoadingState ? (
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
          themes={hasFoundThemes ? stableThemes : themes} 
          isDisturbed={themesLoaded} 
          isLoading={false} 
        />
      )}
    </div>
  );
}

export default ThemeLoader;
