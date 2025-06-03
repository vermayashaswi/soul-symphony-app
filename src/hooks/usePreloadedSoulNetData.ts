
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
  const [graphData, setGraphData] = useState<{ nodes: NodeData[], links: LinkData[] }>({ nodes: [], links: [] });
  const [translations, setTranslations] = useState<Map<string, string>>(new Map());
  const [connectionPercentages, setConnectionPercentages] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { currentLanguage } = useTranslation();

  const preloadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    console.log(`[usePreloadedSoulNetData] Preloading data for ${userId}, ${timeRange}, ${currentLanguage}`);
    
    try {
      setLoading(true);
      setError(null);

      const result = await SoulNetPreloadService.preloadSoulNetData(
        userId,
        timeRange,
        currentLanguage
      );

      if (result) {
        console.log(`[usePreloadedSoulNetData] Successfully loaded preloaded data with ${result.nodes.length} nodes`);
        setGraphData({ nodes: result.nodes, links: result.links });
        setTranslations(result.translations);
        setConnectionPercentages(result.connectionPercentages);
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
