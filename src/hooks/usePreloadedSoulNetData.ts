
import { useState, useEffect, useCallback } from 'react';
import { SoulNetPreloadService } from '@/services/soulnetPreloadService';
import { useTranslation } from '@/contexts/TranslationContext';

interface NodeData {
  id: string;
  type: 'entity' | 'emotion';
  value: number;
  color: string;
  position: [number, number, number];
}

interface LinkData {
  source: string;
  target: string;
  value: number;
}

interface UsePreloadedSoulNetDataReturn {
  graphData: { nodes: NodeData[], links: LinkData[] };
  translations: Map<string, string>;
  connectionPercentages: Map<string, number>;
  loading: boolean;
  error: Error | null;
  preloadData: () => Promise<void>;
}

export const usePreloadedSoulNetData = (
  userId: string | undefined,
  timeRange: string
): UsePreloadedSoulNetDataReturn => {
  const { currentLanguage, prefetchSoulNetTranslations } = useTranslation();
  
  const [graphData, setGraphData] = useState<{ nodes: NodeData[], links: LinkData[] }>({ nodes: [], links: [] });
  const [translations, setTranslations] = useState<Map<string, string>>(new Map());
  const [connectionPercentages, setConnectionPercentages] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  console.log(`[usePreloadedSoulNetData] Hook initialized for user: ${userId}, timeRange: ${timeRange}, language: ${currentLanguage}`);

  const preloadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    console.log(`[usePreloadedSoulNetData] Preloading data for ${userId}, ${timeRange}, ${currentLanguage}`);
    
    try {
      setLoading(true);
      setError(null);

      // FIXED: Use the correct method name 'preloadData' instead of 'preloadSoulNetData'
      const result = await SoulNetPreloadService.preloadData(
        userId,
        timeRange,
        currentLanguage
      );

      if (result) {
        console.log(`[usePreloadedSoulNetData] Successfully loaded preloaded data with ${result.nodes.length} nodes`);
        setGraphData({ nodes: result.nodes, links: result.links });
        setTranslations(result.translations);
        
        // For now, create empty connection percentages since the original service doesn't provide this
        // This maintains compatibility with the hook interface
        setConnectionPercentages(new Map());
      } else {
        console.log('[usePreloadedSoulNetData] No data returned from preload service');
        setGraphData({ nodes: [], links: [] });
        setTranslations(new Map());
        setConnectionPercentages(new Map());
      }
    } catch (err) {
      console.error('[usePreloadedSoulNetData] Error preloading data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
    } finally {
      setLoading(false);
    }
  }, [userId, timeRange, currentLanguage]);

  // Listen for language changes and trigger pre-translation
  useEffect(() => {
    const handleLanguageChange = async (event: CustomEvent) => {
      if (userId && event.detail.language !== 'en') {
        console.log('[usePreloadedSoulNetData] Language changed, triggering pre-translation');
        try {
          await prefetchSoulNetTranslations(userId, timeRange);
          // Refresh data after pre-translation
          await preloadData();
        } catch (error) {
          console.error('[usePreloadedSoulNetData] Error during language change pre-translation:', error);
        }
      }
    };

    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [userId, timeRange, prefetchSoulNetTranslations, preloadData]);

  useEffect(() => {
    preloadData();
  }, [preloadData]);

  // Clear cache when language changes to force refresh
  useEffect(() => {
    if (userId) {
      SoulNetPreloadService.clearCache(userId);
    }
  }, [currentLanguage, userId]);

  return {
    graphData,
    translations,
    connectionPercentages,
    loading,
    error,
    preloadData
  };
};
