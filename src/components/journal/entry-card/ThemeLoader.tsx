
import React, { useEffect, useState, useRef } from 'react';
import ThemeBoxes from '../ThemeBoxes';
import { supabase } from '@/integrations/supabase/client';

interface ThemeLoaderProps {
  entryId: number;
  initialThemes: string[];
  content: string;
  isProcessing?: boolean;
  isNew?: boolean;
}

export function ThemeLoader({ 
  entryId, 
  initialThemes, 
  content, 
  isProcessing = false, 
  isNew = false 
}: ThemeLoaderProps) {
  const [themes, setThemes] = useState<string[]>(initialThemes);
  const [isThemesLoading, setIsThemesLoading] = useState(isProcessing);
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
    
    // Filter out empty themes
    const filteredThemes = initialThemes.filter(theme => 
      theme && typeof theme === 'string' && theme.trim() !== '' && theme !== '•'
    );
    
    setThemes(filteredThemes);
    
    // Determine if themes are still loading
    const shouldBeLoading = isProcessing || (filteredThemes.length === 0 && isNew);
    setIsThemesLoading(shouldBeLoading);
    
    // If themes are loading and we have an entry ID, poll for themes
    if (shouldBeLoading && entryId) {
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
              ? entryData.master_themes.filter(t => t && t.trim() !== '' && t !== '•') 
              : [];
              
            const updatedThemes = Array.isArray(entryData.themes) 
              ? entryData.themes.filter(t => t && t.trim() !== '' && t !== '•') 
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
  }, [entryId, initialThemes, content, isProcessing, isNew]);

  // Generate fallback themes from content
  const generateFallbackThemes = (text: string): string[] => {
    const words = text.split(/\s+/);
    const longWords = words
      .filter(word => word.length > 5)
      .slice(0, 3)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
    
    if (longWords.length > 0) {
      return [...new Set(longWords)]; // Remove duplicates
    }
    return [];
  };

  return (
    <div className="mt-3 md:mt-4">
      <h4 className="text-xs md:text-sm font-semibold text-foreground">Themes</h4>
      <ThemeBoxes 
        themes={themes} 
        isDisturbed={true}
        isLoading={isThemesLoading} 
      />
    </div>
  );
}

export default ThemeLoader;
