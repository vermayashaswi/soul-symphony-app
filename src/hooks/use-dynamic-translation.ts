import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { translationService } from '@/services/translationService';

interface DynamicTranslationState {
  isTranslating: boolean;
  translatedContent: Map<string, string>;
  pendingTranslations: Set<string>;
}

export const useDynamicTranslation = () => {
  const { currentLanguage } = useTranslation();
  const [state, setState] = useState<DynamicTranslationState>({
    isTranslating: false,
    translatedContent: new Map(),
    pendingTranslations: new Set()
  });
  
  const translationQueue = useRef<string[]>([]);
  const processingRef = useRef(false);

  // Function to request translation of dynamic content
  const requestTranslation = useCallback(async (texts: string[]) => {
    if (currentLanguage === 'en' || texts.length === 0) {
      return;
    }

    // Filter out texts that are already translated or being processed
    const newTexts = texts.filter(text => 
      !state.translatedContent.has(text) && 
      !state.pendingTranslations.has(text)
    );

    if (newTexts.length === 0) return;

    // Add to pending translations
    setState(prev => ({
      ...prev,
      pendingTranslations: new Set([...prev.pendingTranslations, ...newTexts])
    }));

    // Add to queue
    translationQueue.current.push(...newTexts);

    // Process queue if not already processing
    if (!processingRef.current) {
      processTranslationQueue();
    }
  }, [currentLanguage, state.translatedContent, state.pendingTranslations]);

  const processTranslationQueue = useCallback(async () => {
    if (processingRef.current || translationQueue.current.length === 0) {
      return;
    }

    processingRef.current = true;
    setState(prev => ({ ...prev, isTranslating: true }));

    try {
      // Process queue in batches of 10
      const batchSize = 10;
      
      while (translationQueue.current.length > 0) {
        const batch = translationQueue.current.splice(0, batchSize);
        
        if (batch.length > 0) {
          const batchResults = await translationService.batchTranslate({
            texts: batch,
            targetLanguage: currentLanguage
          });

          setState(prev => {
            const newTranslatedContent = new Map(prev.translatedContent);
            const newPendingTranslations = new Set(prev.pendingTranslations);

            batchResults.forEach((translation, text) => {
              newTranslatedContent.set(text, translation);
              newPendingTranslations.delete(text);
            });

            return {
              ...prev,
              translatedContent: newTranslatedContent,
              pendingTranslations: newPendingTranslations
            };
          });
        }
      }
    } catch (error) {
      console.error('[DynamicTranslation] Error processing translation queue:', error);
      
      // Clear pending translations on error
      setState(prev => ({
        ...prev,
        pendingTranslations: new Set()
      }));
    } finally {
      processingRef.current = false;
      setState(prev => ({ ...prev, isTranslating: false }));
    }
  }, [currentLanguage]);

  // Get translated text
  const getTranslatedText = useCallback((text: string): string => {
    return state.translatedContent.get(text) || text;
  }, [state.translatedContent]);

  // Check if text is being translated
  const isTextBeingTranslated = useCallback((text: string): boolean => {
    return state.pendingTranslations.has(text);
  }, [state.pendingTranslations]);

  // Clear translations when language changes
  useEffect(() => {
    setState({
      isTranslating: false,
      translatedContent: new Map(),
      pendingTranslations: new Set()
    });
    translationQueue.current = [];
    processingRef.current = false;
  }, [currentLanguage]);

  return {
    isTranslating: state.isTranslating,
    requestTranslation,
    getTranslatedText,
    isTextBeingTranslated,
    hasTranslation: (text: string) => state.translatedContent.has(text)
  };
};