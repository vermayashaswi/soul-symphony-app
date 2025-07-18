
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
  
  // Optimistic initialization - check cache synchronously first
  const getCachedDataSync = useCallback(() => {
    if (!userId) return null;
    const cacheKey = `${userId}-${timeRange}-${currentLanguage}`;
    return SoulNetPreloadService.getCachedDataSync(cacheKey);
  }, [userId, timeRange, currentLanguage]);

  const initialCachedData = getCachedDataSync();
  const hasInitialCache = initialCachedData !== null;

  const [graphData, setGraphData] = useState<{ nodes: NodeData[], links: LinkData[] }>(
    hasInitialCache ? { nodes: initialCachedData.nodes, links: initialCachedData.links } : { nodes: [], links: [] }
  );
  const [translations, setTranslations] = useState<Map<string, string>>(
    hasInitialCache ? initialCachedData.translations : new Map()
  );
  const [connectionPercentages, setConnectionPercentages] = useState<Map<string, number>>(
    hasInitialCache ? initialCachedData.connectionPercentages : new Map()
  );
  const [loading, setLoading] = useState(!hasInitialCache); // Only load if no cache
  const [error, setError] = useState<Error | null>(null);

  console.log(`[usePreloadedSoulNetData] Initial state - hasCache: ${hasInitialCache}, loading: ${!hasInitialCache}, nodes: ${hasInitialCache ? initialCachedData.nodes.length : 0}`);

  const preloadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    console.log(`[usePreloadedSoulNetData] Preloading data for ${userId}, ${timeRange}, ${currentLanguage}`);
    
    try {
      // Only set loading if we don't have cached data
      if (!hasInitialCache) {
        setLoading(true);
      }
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
        if (!hasInitialCache) {
          setGraphData({ nodes: [], links: [] });
          setTranslations(new Map());
          setConnectionPercentages(new Map());
        }
      }
    } catch (err) {
      console.error('[usePreloadedSoulNetData] Error preloading data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
    } finally {
      setLoading(false);
    }
  }, [userId, timeRange, currentLanguage, hasInitialCache]);

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
    // Only preload if we don't have initial cached data
    if (!hasInitialCache) {
      preloadData();
    } else {
      console.log('[usePreloadedSoulNetData] Using initial cached data, skipping preload');
    }
  }, [preloadData, hasInitialCache]);

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
