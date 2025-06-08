
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { soulNetTranslationManager } from '@/services/soulNetTranslationManager';

interface UseSoulNetTranslationReturn {
  getTranslatedText: (nodeId: string) => string;
  isNodeTranslating: (nodeId: string) => boolean;
  translateNodes: (nodeIds: string[]) => Promise<void>;
  isAnyTranslating: boolean;
  translationProgress: { totalNodes: number; translatedNodes: number };
}

export const useSoulNetTranslation = (): UseSoulNetTranslationReturn => {
  const { currentLanguage } = useTranslation();
  const [, forceUpdate] = useState({});

  // Force re-render when translation states change
  useEffect(() => {
    const unsubscribe = soulNetTranslationManager.subscribe(() => {
      forceUpdate({});
    });

    return unsubscribe;
  }, []);

  // Update language when it changes
  useEffect(() => {
    soulNetTranslationManager.setCurrentLanguage(currentLanguage);
  }, [currentLanguage]);

  const getTranslatedText = useCallback((nodeId: string): string => {
    const state = soulNetTranslationManager.getTranslationState(nodeId);
    return state.translatedText;
  }, []);

  const isNodeTranslating = useCallback((nodeId: string): boolean => {
    const state = soulNetTranslationManager.getTranslationState(nodeId);
    return state.isTranslating;
  }, []);

  const translateNodes = useCallback(async (nodeIds: string[]): Promise<void> => {
    await soulNetTranslationManager.batchTranslateNodes(nodeIds);
  }, []);

  const overallState = soulNetTranslationManager.getOverallTranslationState();

  return {
    getTranslatedText,
    isNodeTranslating,
    translateNodes,
    isAnyTranslating: overallState.isAnyTranslating,
    translationProgress: {
      totalNodes: overallState.totalNodes,
      translatedNodes: overallState.translatedNodes
    }
  };
};
