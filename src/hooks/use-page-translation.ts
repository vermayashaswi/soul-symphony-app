
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { translationService } from '@/services/translationService';

interface PageTranslationState {
  isTranslating: boolean;
  progress: number;
  totalTexts: number;
  translatedTexts: number;
  error: string | null;
}

interface UsePageTranslationProps {
  pageTexts: string[];
  route: string;
  enabled?: boolean;
}

export const usePageTranslation = ({ 
  pageTexts, 
  route, 
  enabled = true 
}: UsePageTranslationProps) => {
  const { currentLanguage, getCachedTranslation } = useTranslation();
  const [state, setState] = useState<PageTranslationState>({
    isTranslating: false,
    progress: 0,
    totalTexts: 0,
    translatedTexts: 0,
    error: null
  });
  
  const translationRef = useRef<Map<string, string>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  const translatePageTexts = useCallback(async () => {
    if (!enabled || currentLanguage === 'en' || pageTexts.length === 0) {
      setState(prev => ({ ...prev, isTranslating: false, progress: 100 }));
      return;
    }

    // Cancel any ongoing translation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setState({
      isTranslating: true,
      progress: 0,
      totalTexts: pageTexts.length,
      translatedTexts: 0,
      error: null
    });

    try {
      console.log(`[PageTranslation] Starting batch translation for ${pageTexts.length} texts`);
      
      // Filter texts that need translation
      const textsToTranslate: string[] = [];
      const cachedTranslations = new Map<string, string>();
      
      pageTexts.forEach(text => {
        const cached = getCachedTranslation(text);
        if (cached) {
          cachedTranslations.set(text, cached);
          translationRef.current.set(text, cached);
        } else if (text.trim()) {
          textsToTranslate.push(text);
        }
      });

      setState(prev => ({
        ...prev,
        translatedTexts: cachedTranslations.size,
        progress: (cachedTranslations.size / pageTexts.length) * 100
      }));

      if (textsToTranslate.length > 0) {
        // FIXED: Use correct batchTranslate API
        const batchResults = await translationService.batchTranslate(
          textsToTranslate,
          'en',
          currentLanguage
        );

        // Update state with results
        batchResults.forEach((translation, text) => {
          translationRef.current.set(text, translation);
        });

        setState(prev => ({
          ...prev,
          isTranslating: false,
          progress: 100,
          translatedTexts: pageTexts.length
        }));
      } else {
        setState(prev => ({
          ...prev,
          isTranslating: false,
          progress: 100
        }));
      }

      console.log(`[PageTranslation] Completed translation for ${pageTexts.length} texts`);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('[PageTranslation] Translation error:', error);
        setState(prev => ({
          ...prev,
          isTranslating: false,
          error: 'Translation failed'
        }));
      }
    }
  }, [pageTexts, currentLanguage, enabled, getCachedTranslation]);

  useEffect(() => {
    translatePageTexts();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [translatePageTexts]);

  const getTranslation = useCallback((text: string): string | null => {
    return translationRef.current.get(text) || null;
  }, []);

  return {
    ...state,
    getTranslation,
    retryTranslation: translatePageTexts
  };
};
