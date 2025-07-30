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

      // Set timeout for the entire translation process
      const translationTimeout = setTimeout(() => {
        console.warn('useR3FBulkTranslation: Translation timeout reached, using original texts');
        const fallbackTranslations: Record<string, string> = {};
        uniqueTexts.forEach(text => {
          fallbackTranslations[text] = text;
        });
        setTranslatedTexts(fallbackTranslations);
        setIsComplete(true);
        setIsLoading(false);
      }, 4000); // 4 second timeout for all translations

      try {
        // Translate all texts in parallel with individual timeouts
        const translationPromises = uniqueTexts.map(async (text) => {
          if (!text) return { original: text, translated: '' };
          
          try {
            // Create a timeout promise for each translation
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Individual translation timeout')), 2000);
            });
            
            const translationPromise = translate(text, sourceLanguage);
            const result = await Promise.race([translationPromise, timeoutPromise]);
            return { original: text, translated: result || text };
          } catch (error) {
            console.warn(`Translation failed for "${text}":`, error);
            return { original: text, translated: text }; // Fallback to original
          }
        });

        const results = await Promise.all(translationPromises);
        
        clearTimeout(translationTimeout);
        
        const translations: Record<string, string> = {};
        results.forEach(({ original, translated }) => {
          translations[original] = translated;
        });

        setTranslatedTexts(translations);
        setIsComplete(true);
      } catch (error) {
        console.warn('Bulk translation failed:', error);
        clearTimeout(translationTimeout);
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