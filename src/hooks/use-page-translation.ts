
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

  // Helper: Debounced state update for smoother progress bar UI
  const updateProgress = useCallback((translated: number, total: number) => {
    setState(prev => ({
      ...prev,
      translatedTexts: translated,
      progress: total === 0 ? 100 : Math.min(100, Math.round((translated / total) * 100))
    }));
  }, []);

  // The actual translation handler
  const translatePageTexts = useCallback(async () => {
    // Reset state at the start of any translation
    setState({
      isTranslating: true,
      progress: 0,
      totalTexts: pageTexts.length,
      translatedTexts: 0,
      error: null
    });
    translationRef.current = new Map();

    if (!enabled || currentLanguage === 'en' || pageTexts.length === 0) {
      setState({
        isTranslating: false,
        progress: 100,
        totalTexts: pageTexts.length,
        translatedTexts: pageTexts.length,
        error: null
      });
      return;
    }

    // Cancel ongoing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Progress-tracking
    let translatedCount = 0;
    let errorOccured = false;

    try {
      // Cache check
      const textsToTranslate: string[] = [];
      pageTexts.forEach(text => {
        const cached = getCachedTranslation(text);
        if (cached) {
          translationRef.current.set(text, cached);
          translatedCount++;
        } else if (text.trim()) {
          textsToTranslate.push(text);
        }
      });
      updateProgress(translatedCount, pageTexts.length);

      // Batch translation (in small chunks to enable progress reporting)
      const BATCH_SIZE = 10;
      for (let i = 0; i < textsToTranslate.length; i += BATCH_SIZE) {
        const chunk = textsToTranslate.slice(i, i + BATCH_SIZE);
        try {
          const batchResults = await translationService.batchTranslate({
            texts: chunk,
            targetLanguage: currentLanguage
          });
          batchResults.forEach((translation, text) => {
            translationRef.current.set(text, translation);
            translatedCount++;
          });
          updateProgress(translatedCount, pageTexts.length);
        } catch (err) {
          // Fallback to English for failed batch
          chunk.forEach(text => {
            translationRef.current.set(text, text);
            translatedCount++;
          });
          errorOccured = true;
          updateProgress(translatedCount, pageTexts.length);
        }
      }

      setState(prev => ({
        ...prev,
        isTranslating: false,
        translatedTexts: pageTexts.length,
        progress: 100,
        error: errorOccured ? "Some translations failed. Showing English for those." : null
      }));
    } catch (error: any) {
      console.error('[PageTranslation] Translation error/failure for route', route, error);
      setState(prev => ({
        ...prev,
        isTranslating: false,
        error: 'Translation failed',
        progress: 100 // Force finish loader
      }));
    }
  }, [pageTexts, currentLanguage, enabled, getCachedTranslation, updateProgress, route]);

  useEffect(() => {
    translatePageTexts();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [translatePageTexts]);

  // Always provide a getter with fallback to English text
  const getTranslation = useCallback((text: string): string | null => {
    return translationRef.current.get(text) ?? text ?? null;
  }, []);

  return {
    ...state,
    getTranslation,
    retryTranslation: translatePageTexts
  };
};
