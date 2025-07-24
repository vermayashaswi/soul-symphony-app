
import React, { useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { loadingStateManager, LoadingPriority } from '@/services/loadingStateManager';

export function TranslationLoadingOverlay() {
  // Safe access to the translation context with default values
  let isTranslating = false;
  let translationProgress = 0;
  
  try {
    const translationContext = useTranslation();
    isTranslating = translationContext?.isTranslating || false;
    translationProgress = translationContext?.translationProgress || 0;
  } catch (error) {
    console.error('TranslationLoadingOverlay: Error accessing translation context', error);
    return null; // Return nothing if context isn't available yet
  }

  // Register with unified loading manager
  useEffect(() => {
    if (isTranslating) {
      loadingStateManager.setLoading('translation', LoadingPriority.MEDIUM, `Translating content... ${translationProgress}%`);
    } else {
      loadingStateManager.clearLoading('translation');
    }

    return () => {
      loadingStateManager.clearLoading('translation');
    };
  }, [isTranslating, translationProgress]);

  // This component no longer renders its own UI - handled by UnifiedLoadingOverlay
  return null;
}
