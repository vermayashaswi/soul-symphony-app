
import React, { useState, useEffect } from 'react';
import { ThemeBoxes } from '../ThemeBoxes';
import { supabase } from '@/integrations/supabase/client';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';

interface ThemeLoaderProps {
  entryId: number;
  initialThemes?: string[];
  content: string;
  isProcessing?: boolean;
  isNew?: boolean;
}

interface EntryData {
  id: number;
  original_language?: string;
  themes?: string[];
  master_themes?: string[];
  [key: string]: any;
}

export function ThemeLoader({ entryId, initialThemes = [], content, isProcessing = false, isNew = false }: ThemeLoaderProps) {
  const [themes, setThemes] = useState<string[]>(initialThemes || []);
  const [loading, setLoading] = useState(isProcessing || initialThemes.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [entryLanguage, setEntryLanguage] = useState<string | undefined>(undefined);
  const { currentLanguage } = useTranslation();

  useEffect(() => {
    if (!entryId || isNew) return;
    
    const fetchEntryData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Select both themes and master_themes to handle transition period
        const { data, error } = await supabase
          .from('Journal Entries')
          .select('*')
          .eq('id', entryId)
          .single();

        if (error) {
          console.error('Error fetching themes:', error);
          setError("Couldn't load themes");
          return;
        }

        if (data) {
          const entryData = data as EntryData;
          
          if (entryData.original_language) {
            setEntryLanguage(entryData.original_language);
          }
          
          // Prioritize specific themes from themes column for display
          let displayThemes: string[] = [];
          
          if (Array.isArray(entryData.themes) && entryData.themes.length > 0) {
            // Use specific themes from themes column
            displayThemes = entryData.themes.filter(theme => 
              theme && typeof theme === 'string' && theme.trim() !== '' && theme !== '•'
            );
            console.log('[ThemeLoader] Using specific themes from themes column:', displayThemes);
          } else if (Array.isArray(entryData.master_themes) && entryData.master_themes.length > 0) {
            // Fallback to master_themes for backward compatibility
            displayThemes = entryData.master_themes.filter(theme => 
              theme && typeof theme === 'string' && theme.trim() !== '' && theme !== '•'
            );
            console.log('[ThemeLoader] Fallback to master_themes:', displayThemes);
          }
          
          setThemes(displayThemes);
        }
      } catch (err) {
        console.error('Exception in theme loading:', err);
        setError("Error loading themes");
      } finally {
        setLoading(false);
      }
    };

    fetchEntryData();
  }, [entryId, isNew]);

  return (
    <div className="mt-2">
      <h3 className="text-sm font-medium mb-1 text-primary">
        <TranslatableText 
          text="Themes" 
          sourceLanguage={entryLanguage || "en"}
          entryId={entryId}
        />
      </h3>
      
      {loading && (
        <div className="flex gap-2 flex-wrap">
          <div className="h-6 w-16 bg-muted animate-pulse rounded"></div>
          <div className="h-6 w-20 bg-muted animate-pulse rounded"></div>
          <div className="h-6 w-14 bg-muted animate-pulse rounded"></div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {!loading && !error && themes.length === 0 && (
        <p className="text-xs text-muted-foreground">
          <TranslatableText 
            text={isProcessing || isNew ? "Analyzing themes..." : "No themes detected"} 
            sourceLanguage={entryLanguage || "en"}
            entryId={entryId}
          />
        </p>
      )}

      {!loading && !error && themes.length > 0 && (
        <ThemeBoxes themes={themes} entryId={entryId} sourceLanguage={entryLanguage || "en"} />
      )}
    </div>
  );
}

export default ThemeLoader;
