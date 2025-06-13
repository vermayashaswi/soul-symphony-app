
import { useState, useEffect, useCallback } from 'react';
import { SoulNetPreloadService } from '@/services/soulnetPreloadService';
import { EnhancedSoulNetPreloadService } from '@/services/enhancedSoulNetPreloadService';
import { NodeTranslationCacheService } from '@/services/nodeTranslationCache';
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
  
  // ENHANCED: Check enhanced cache first, fallback to legacy
  const getCachedDataSync = useCallback(() => {
    if (!userId) return null;
    
    // Try enhanced service first
    const enhancedCacheKey = `${userId}-${timeRange}-${currentLanguage}`;
    const enhancedCached = EnhancedSoulNetPreloadService.getInstantData(enhancedCacheKey);
    if (enhancedCached && enhancedCached.data.translationComplete) {
      console.log('[usePreloadedSoulNetData] ENHANCED: Using enhanced cached data');
      return {
        nodes: enhancedCached.data.nodes,
        links: enhancedCached.data.links,
        translations: enhancedCached.data.translations,
        connectionPercentages: enhancedCached.data.connectionPercentages
      };
    }
    
    // Fallback to legacy cache
    const legacyCacheKey = `${userId}-${timeRange}-${currentLanguage}`;
    const legacyCached = SoulNetPreloadService.getCachedDataSync(legacyCacheKey);
    if (legacyCached) {
      console.log('[usePreloadedSoulNetData] ENHANCED: Using legacy cached data');
      return legacyCached;
    }
    
    return null;
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
  const [loading, setLoading] = useState(!hasInitialCache);
  const [error, setError] = useState<Error | null>(null);

  console.log(`[usePreloadedSoulNetData] ENHANCED: Initial state - hasCache: ${hasInitialCache}, loading: ${!hasInitialCache}, nodes: ${hasInitialCache ? initialCachedData.nodes.length : 0}`);

  const preloadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    console.log(`[usePreloadedSoulNetData] ENHANCED: Preloading data for ${userId}, ${timeRange}, ${currentLanguage}`);
    
    try {
      if (!hasInitialCache) {
        setLoading(true);
      }
      setError(null);

      // ENHANCED: Try enhanced service first
      try {
        const enhancedResult = await EnhancedSoulNetPreloadService.preloadInstantData(
          userId,
          timeRange,
          currentLanguage
        );

        if (enhancedResult && enhancedResult.translationComplete) {
          console.log(`[usePreloadedSoulNetData] ENHANCED: Successfully loaded enhanced data with ${enhancedResult.nodes.length} nodes and ${enhancedResult.translations.size} translations`);
          setGraphData({ nodes: enhancedResult.nodes, links: enhancedResult.links });
          setTranslations(enhancedResult.translations);
          setConnectionPercentages(enhancedResult.connectionPercentages);
          setLoading(false);
          return;
        }
      } catch (enhancedError) {
        console.warn('[usePreloadedSoulNetData] ENHANCED: Enhanced service failed, falling back to legacy:', enhancedError);
      }

      // ENHANCED: Fallback to legacy service
      const legacyResult = await SoulNetPreloadService.preloadSoulNetData(
        userId,
        timeRange,
        currentLanguage
      );

      if (legacyResult) {
        console.log(`[usePreloadedSoulNetData] ENHANCED: Successfully loaded legacy data with ${legacyResult.nodes.length} nodes and ${legacyResult.translations.size} translations`);
        setGraphData({ nodes: legacyResult.nodes, links: legacyResult.links });
        setTranslations(legacyResult.translations);
        setConnectionPercentages(legacyResult.connectionPercentages);
      } else {
        console.log('[usePreloadedSoulNetData] ENHANCED: No data returned from any preload service');
        if (!hasInitialCache) {
          setGraphData({ nodes: [], links: [] });
          setTranslations(new Map());
          setConnectionPercentages(new Map());
        }
      }
    } catch (err) {
      console.error('[usePreloadedSoulNetData] ENHANCED: Error preloading data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
    } finally {
      setLoading(false);
    }
  }, [userId, timeRange, currentLanguage, hasInitialCache]);

  // ENHANCED: Enhanced language change handling with node cache
  useEffect(() => {
    const handleLanguageChange = async (event: CustomEvent) => {
      if (userId && event.detail.language !== 'en') {
        console.log('[usePreloadedSoulNetData] ENHANCED: Language changed, checking node translation cache first');
        
        // Clear old cache for different language
        if (event.detail.previousLanguage && event.detail.previousLanguage !== event.detail.language) {
          NodeTranslationCacheService.clearCache(event.detail.previousLanguage);
          // Also clear enhanced service cache
          EnhancedSoulNetPreloadService.clearInstantCache(userId);
        }
        
        try {
          await prefetchSoulNetTranslations(userId, timeRange);
          // Refresh data after pre-translation
          await preloadData();
        } catch (error) {
          console.error('[usePreloadedSoulNetData] ENHANCED: Error during language change pre-translation:', error);
        }
      }
    };

    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [userId, timeRange, prefetchSoulNetTranslations, preloadData]);

  useEffect(() => {
    if (!hasInitialCache) {
      preloadData();
    } else {
      console.log('[usePreloadedSoulNetData] ENHANCED: Using initial cached data, skipping preload');
    }
  }, [preloadData, hasInitialCache]);

  // ENHANCED: Selective cache clearing - only clear when language actually changes
  useEffect(() => {
    if (userId) {
      const enhancedCacheKey = `${userId}-${timeRange}-${currentLanguage}`;
      const hasEnhancedCache = EnhancedSoulNetPreloadService.getInstantData(enhancedCacheKey);
      
      const legacyCacheKey = `${userId}-${timeRange}-${currentLanguage}`;
      const hasLegacyCache = SoulNetPreloadService.getCachedDataSync(legacyCacheKey);
      
      if (!hasEnhancedCache && !hasLegacyCache) {
        console.log(`[usePreloadedSoulNetData] ENHANCED: No cache for new language ${currentLanguage}, will fetch fresh data`);
      }
    }
  }, [currentLanguage, userId, timeRange]);

  return {
    graphData,
    translations,
    connectionPercentages,
    loading,
    error,
    preloadData
  };
};
