import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';

/**
 * Hook for bulk translating multiple texts for R3F components.
 * Efficiently translates all texts at once and provides loading state.
 */
export const useR3FBulkTranslation = (texts: string[], sourceLanguage?: string) => {
  const { translate, currentLanguage } = useTranslation();
  const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);

  // Memoize unique texts to avoid unnecessary re-translations
  const uniqueTexts = useMemo(() => {
    return Array.from(new Set(texts.filter(text => text && text.trim())));
  }, [texts]);

  useEffect(() => {
    const translateAllTexts = async () => {
      if (!uniqueTexts.length) {
        setTranslatedTexts({});
        setIsComplete(true);
        return;
      }

      // If language is English, return original texts immediately
      if (currentLanguage === 'en') {
        const translations: Record<string, string> = {};
        uniqueTexts.forEach(text => {
          translations[text] = text;
        });
        setTranslatedTexts(translations);
        setIsComplete(true);
        return;
      }

      setIsLoading(true);
      setIsComplete(false);

      try {
        // Translate all texts in parallel
        const translationPromises = uniqueTexts.map(async (text) => {
          if (!text) return { original: text, translated: '' };
          
          try {
            const result = await translate(text, sourceLanguage);
            return { original: text, translated: result || text };
          } catch (error) {
            console.error(`Translation failed for "${text}":`, error);
            return { original: text, translated: text }; // Fallback to original
          }
        });

        const results = await Promise.all(translationPromises);
        
        const translations: Record<string, string> = {};
        results.forEach(({ original, translated }) => {
          translations[original] = translated;
        });

        setTranslatedTexts(translations);
        setIsComplete(true);
      } catch (error) {
        console.error('Bulk translation failed:', error);
        // Fallback: use original texts
        const fallbackTranslations: Record<string, string> = {};
        uniqueTexts.forEach(text => {
          fallbackTranslations[text] = text;
        });
        setTranslatedTexts(fallbackTranslations);
        setIsComplete(true);
      } finally {
        setIsLoading(false);
      }
    };

    translateAllTexts();
  }, [uniqueTexts, currentLanguage, translate, sourceLanguage]);

  // Helper function to get translated text
  const getTranslatedText = (text: string): string => {
    return translatedTexts[text] || text;
  };

  return { 
    translatedTexts, 
    getTranslatedText, 
    isLoading, 
    isComplete 
  };
};