
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

// Define interface for the entry data from database
interface EntryData {
  id: number;
  original_language?: string;
  master_themes?: string[];
  // Other fields that might be returned
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

        const { data, error } = await supabase
          .from('Journal Entries')
          .select('*')  // Select all columns to ensure we get what's available
          .eq('id', entryId)
          .single();

        if (error) {
          console.error('Error fetching themes:', error);
          setError("Couldn't load themes");
          return;
        }

        if (data) {
          // Cast to our interface to safely access properties
          const entryData = data as EntryData;
          
          // Check if there's a language field in the data
          if (entryData.original_language) {
            setEntryLanguage(entryData.original_language);
          }
          
          // Check if master_themes exists in the response
          if (Array.isArray(entryData.master_themes)) {
            const filteredThemes = entryData.master_themes.filter(theme => 
              theme && typeof theme === 'string' && theme.trim() !== '' && theme !== '•'
            );
            setThemes(filteredThemes);
          }
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

  // Display the themes with translation
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
