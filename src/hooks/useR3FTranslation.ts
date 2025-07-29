import { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';

/**
 * Hook for translating text for use in React Three Fiber components.
 * R3F Text components expect plain strings, not React components.
 */
export const useR3FTranslation = (text: string, sourceLanguage?: string) => {
  const { translate, currentLanguage } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const translateText = async () => {
      if (!text) {
        setTranslatedText('');
        return;
      }

      // If language is English, return original text
      if (currentLanguage === 'en') {
        setTranslatedText(text);
        return;
      }

      setIsLoading(true);
      try {
        const result = await translate(text, sourceLanguage);
        setTranslatedText(result || text);
      } catch (error) {
        console.error('Translation failed in useR3FTranslation:', error);
        setTranslatedText(text); // Fallback to original text
      } finally {
        setIsLoading(false);
      }
    };

    translateText();
  }, [text, currentLanguage, translate, sourceLanguage]);

  return { translatedText, isLoading };
};

/**
 * Hook for translating multiple texts for use in React Three Fiber components.
 */
export const useR3FTranslations = (texts: string[], sourceLanguage?: string) => {
  const { translate, currentLanguage } = useTranslation();
  const [translatedTexts, setTranslatedTexts] = useState<string[]>(texts);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const translateTexts = async () => {
      if (!texts.length) {
        setTranslatedTexts([]);
        return;
      }

      // If language is English, return original texts
      if (currentLanguage === 'en') {
        setTranslatedTexts(texts);
        return;
      }

      setIsLoading(true);
      try {
        const results = await Promise.all(
          texts.map(async (text) => {
            if (!text) return '';
            const result = await translate(text, sourceLanguage);
            return result || text;
          })
        );
        setTranslatedTexts(results);
      } catch (error) {
        console.error('Translation failed in useR3FTranslations:', error);
        setTranslatedTexts(texts); // Fallback to original texts
      } finally {
        setIsLoading(false);
      }
    };

    translateTexts();
  }, [texts, currentLanguage, translate, sourceLanguage]);

  return { translatedTexts, isLoading };
};