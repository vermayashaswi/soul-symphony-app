import React, { useState, useEffect, useRef } from 'react';
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

interface JournalEntry {
  id: number;
  master_themes?: string[];
  themes?: string[];
  created_at?: string;
  [key: string]: any;
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
  const initialFetchRef = useRef<boolean>(false);

  useEffect(() => {
    console.log(`[ThemeLoader] Mounted for entry ${entryId}`);
    mountedRef.current = true;
    
    if (initialThemes && initialThemes.length > 0) {
      console.log(`[ThemeLoader] Using initial themes for entry ${entryId}:`, initialThemes);
      setThemes(initialThemes);
      setStableThemes(initialThemes);
      setThemesLoaded(true);
      setHasFoundThemes(true);
      setIsThemesLoading(false);
      
      window.dispatchEvent(new CustomEvent('themesUpdated', { 
        detail: { entryId, themes: initialThemes }
      }));
    } else if (entryId && !isProcessing) {
      fetchThemesImmediately();
    }
    
    return () => {
      mountedRef.current = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, [entryId, initialThemes]);

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
        await triggerThemeExtraction(entryId);
        startPollingForThemes();
        return;
      }
      
      if (data && typeof data === 'object') {
        const entryData = data as JournalEntry;
        const updatedMasterThemes = Array.isArray(entryData.master_themes)
          ? entryData.master_themes.filter(t => t && typeof t === 'string' && t.trim() !== '' && t !== '•') 
          : [];
          
        const updatedThemes = Array.isArray(entryData.themes)
          ? entryData.themes.filter(t => t && typeof t === 'string' && t.trim() !== '' && t !== '•') 
          : [];
          
        const updatedCurrentThemes = updatedMasterThemes.length > 0 ? updatedMasterThemes : updatedThemes;
        
        if (updatedCurrentThemes.length > 0 && mountedRef.current) {
          setStableThemes(updatedCurrentThemes);
          setThemes(updatedCurrentThemes);
          setThemesLoaded(true);
          setIsThemesLoading(false);
          setHasFoundThemes(true);
          
          window.dispatchEvent(new CustomEvent('themesUpdated', { 
            detail: { entryId, themes: updatedCurrentThemes }
          }));
          return;
        }
      }
      
      await triggerThemeExtraction(entryId);
      startPollingForThemes();
      
    } catch (err) {
      console.error(`[ThemeLoader] Error in immediate theme fetch: ${err}`);
    }
  };

  const startPollingForThemes = () => {
    if (!mountedRef.current || !entryId) return;
    
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    console.log(`[ThemeLoader] Starting theme polling for entry ${entryId}`);
    setIsThemesLoading(true);
    
    pollForThemes();
    pollIntervalRef.current = setInterval(pollForThemes, 500); // Reduced from 1000ms to 500ms
    
    safetyTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      
      console.log(`[ThemeLoader] Safety timeout reached for entry ${entryId}`);
      
      if (themes.length === 0 && content && mountedRef.current) {
        const fallbackThemes = generateFallbackThemes(content);
        if (fallbackThemes.length > 0) {
          setStableThemes(fallbackThemes);
          setThemes(fallbackThemes);
          setThemesLoaded(true);
          
          window.dispatchEvent(new CustomEvent('themesUpdated', { 
            detail: { entryId, themes: fallbackThemes, isFallback: true }
          }));
        }
      }
      
      setIsThemesLoading(false);
      
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }, 5000); // Reduced from 15000ms to 5000ms
  };

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
        
      if (data && typeof data === 'object') {
        const entryData = data as JournalEntry;
        
        const updatedMasterThemes = Array.isArray(entryData.master_themes)
          ? entryData.master_themes.filter(t => t && typeof t === 'string' && t.trim() !== '' && t !== '•') 
          : [];
          
        const updatedThemes = Array.isArray(entryData.themes)
          ? entryData.themes.filter(t => t && typeof t === 'string' && t.trim() !== '' && t !== '•') 
          : [];
          
        const updatedCurrentThemes = updatedMasterThemes.length > 0 ? updatedMasterThemes : updatedThemes;
        
        if (updatedCurrentThemes.length > 0 && mountedRef.current) {
          console.log(`[ThemeLoader] Found themes for entry ${entryId}:`, updatedCurrentThemes);
          
          setStableThemes(updatedCurrentThemes);
          setHasFoundThemes(true);
          setThemes(updatedCurrentThemes);
          setIsThemesLoading(false);
          setThemesLoaded(true);
          
          window.dispatchEvent(new CustomEvent('themesUpdated', { 
            detail: { entryId, themes: updatedCurrentThemes }
          }));
          
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          
          if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
          }
        } else if (!isProcessing && mountedRef.current && entryId) {
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

  const generateFallbackThemes = (text: string): string[] => {
    try {
      if (!text || typeof text !== 'string') return [];
      
      const words = text.split(/\s+/);
      const uniqueWords = new Set<string>();
      
      words.forEach(word => {
        if (word.length > 5 && !word.match(/^\d+$/)) {
          uniqueWords.add(word.replace(/[^\w\s]|_/g, '').toLowerCase());
        }
      });
      
      return Array.from(uniqueWords).slice(0, 3);
    } catch (err) {
      console.error(`[ThemeLoader] Error generating fallback themes: ${err}`);
      return [];
    }
  };

  const handleRetry = () => {
    setHasError(false);
    setRetryCount(prev => prev + 1);
    setIsThemesLoading(true);
    setThemesLoaded(false);
    
    if (entryId) {
      triggerThemeExtraction(entryId)
        .then(success => {
          console.log(`[ThemeLoader] Retry theme extraction triggered: ${success}`);
          startPollingForThemes();
        })
        .catch(err => console.error('[ThemeLoader] Error triggering theme extraction on retry:', err));
    }
  };

  useEffect(() => {
    try {
      if (!Array.isArray(initialThemes)) {
        console.warn(`[ThemeLoader] initialThemes is not an array for entry ${entryId}:`, initialThemes);
        setThemes([]);
      } else {
        const filteredThemes = initialThemes.filter(theme => 
          theme && typeof theme === 'string' && theme.trim() !== '' && theme !== '•'
        );
        
        if (filteredThemes.length > 0) {
          setThemes(filteredThemes);
          setStableThemes(filteredThemes);
          setThemesLoaded(true);
          setIsThemesLoading(false);
          setHasFoundThemes(true);
          
          window.dispatchEvent(new CustomEvent('themesUpdated', { 
            detail: { entryId, themes: filteredThemes }
          }));
        } else {
          setThemes([]);
          const shouldBeLoading = isProcessing || isNew;
          setIsThemesLoading(shouldBeLoading);
          setThemesLoaded(false);
          
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

  useEffect(() => {
    if (!mountedRef.current || !entryId) return;
    
    if (stableThemes.length > 0 && hasFoundThemes) {
      console.log(`[ThemeLoader] Already have stable themes for entry ${entryId}, skipping polling`);
      return;
    }
    
    if (themes.length > 0 && themesLoaded && !isProcessing) {
      console.log(`[ThemeLoader] Already have themes for entry ${entryId}, skipping polling`);
      return;
    }
    
    const handleContentReady = () => {
      if (!hasFoundThemes && entryId) {
        console.log(`[ThemeLoader] Content ready event received, triggering theme extraction for entry ${entryId}`);
        fetchThemesImmediately();
      }
    };
    
    window.addEventListener('entryContentReady', handleContentReady);
    
    if (!stableThemes.length && !hasFoundThemes) {
      startPollingForThemes();
    }
    
    return () => {
      window.removeEventListener('entryContentReady', handleContentReady);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, [entryId, isNew, isProcessing, themesLoaded, content, themes.length, stableThemes.length, hasFoundThemes]);

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
          className="mb-1"
          size="sm"
        />
      )}
    </div>
  );
}

export default ThemeLoader;
