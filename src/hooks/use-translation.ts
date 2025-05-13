
import { useState, useCallback } from 'react';

export function useTranslation() {
  const [isTranslating, setIsTranslating] = useState(false);
  
  const translateText = useCallback(async (text: string, targetLanguage: string) => {
    setIsTranslating(true);
    try {
      // In a real implementation, this would call a translation API
      // For now, just return the original text
      await new Promise(resolve => setTimeout(resolve, 500));
      return text;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    } finally {
      setIsTranslating(false);
    }
  }, []);
  
  return {
    isTranslating,
    translateText
  };
}
