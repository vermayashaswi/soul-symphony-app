
import { useState, useEffect, useCallback, useRef } from 'react';
import { SoulNetPreloadService } from '@/services/soulnetPreloadService';
import { useTranslation } from '@/contexts/TranslationContext';
import { translationService } from '@/services/translationService';
import { onDemandTranslationCache } from '@/utils/website-translations';

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

interface UseInstantSoulNetDataReturn {
  graphData: { nodes: NodeData[], links: LinkData[] };
  loading: boolean;
  error: Error | null;
  isInstantReady: boolean;
  getInstantTranslation: (text: string) => string;
  getInstantConnectionPercentage: (sourceId: string, targetId: string) => number;
  getInstantNodeConnections: (nodeId: string) => LinkData[];
}

export const useInstantSoulNetData = (
  userId: string | undefined,
  timeRange: string
): UseInstantSoulNetDataReturn => {
  const { currentLanguage } = useTranslation();
  
  // Initialize with synchronous cache check
  const getCachedDataSync = useCallback(() => {
    if (!userId) return null;
    const cacheKey = `${userId}-${timeRange}-${currentLanguage}`;
    return SoulNetPreloadService.getCachedDataSync(cacheKey);
  }, [userId, timeRange, currentLanguage]);

  const initialCachedData = getCachedDataSync();
  
  const [graphData, setGraphData] = useState<{ nodes: NodeData[], links: LinkData[] }>(
    initialCachedData ? { nodes: initialCachedData.nodes, links: initialCachedData.links } : { nodes: [], links: [] }
  );
  const [loading, setLoading] = useState(!initialCachedData);
  const [error, setError] = useState<Error | null>(null);
  const [isInstantReady, setIsInstantReady] = useState(!!initialCachedData);
  
  // Store preloaded data for instant access
  const preloadedDataRef = useRef<{
    translations: Map<string, string>;
    connectionPercentages: Map<string, number>;
    nodeConnections: Map<string, LinkData[]>;
  }>({
    translations: initialCachedData?.translations || new Map(),
    connectionPercentages: initialCachedData?.connectionPercentages || new Map(),
    nodeConnections: new Map()
  });

  // Update node connections when graph data changes
  useEffect(() => {
    if (graphData.links.length > 0) {
      const connectionMap = new Map<string, LinkData[]>();
      graphData.links.forEach(link => {
        if (!connectionMap.has(link.source)) {
          connectionMap.set(link.source, []);
        }
        if (!connectionMap.has(link.target)) {
          connectionMap.set(link.target, []);
        }
        connectionMap.get(link.source)!.push(link);
        connectionMap.get(link.target)!.push(link);
      });
      preloadedDataRef.current.nodeConnections = connectionMap;
    }
  }, [graphData.links]);

  // Instant translation function with multiple fallbacks
  const getInstantTranslation = useCallback((text: string): string => {
    if (!text || currentLanguage === 'en') return text;

    // PRIORITY 1: Pre-cached translation from SoulNet preload
    const preloadedTranslation = preloadedDataRef.current.translations.get(text);
    if (preloadedTranslation) {
      return preloadedTranslation;
    }

    // PRIORITY 2: On-demand cache
    const onDemandTranslation = onDemandTranslationCache.get(currentLanguage, text);
    if (onDemandTranslation) {
      return onDemandTranslation;
    }

    // PRIORITY 3: Background translation request (non-blocking)
    if (userId) {
      translationService.translateText(text, currentLanguage)
        .then(translated => {
          if (translated && translated !== text) {
            // Update both caches
            preloadedDataRef.current.translations.set(text, translated);
            onDemandTranslationCache.set(currentLanguage, text, translated);
          }
        })
        .catch(err => {
          console.warn(`[useInstantSoulNetData] Background translation failed for "${text}":`, err);
        });
    }

    // FALLBACK: Return original text (no loading states or delays)
    return text;
  }, [currentLanguage, userId]);

  // Instant connection percentage lookup
  const getInstantConnectionPercentage = useCallback((sourceId: string, targetId: string): number => {
    const key = `${sourceId}-${targetId}`;
    return preloadedDataRef.current.connectionPercentages.get(key) || 0;
  }, []);

  // Instant node connections lookup
  const getInstantNodeConnections = useCallback((nodeId: string): LinkData[] => {
    return preloadedDataRef.current.nodeConnections.get(nodeId) || [];
  }, []);

  // Enhanced data loading with race condition prevention
  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setIsInstantReady(false);
      return;
    }

    console.log(`[useInstantSoulNetData] Loading data for ${userId}, ${timeRange}, ${currentLanguage}`);
    
    try {
      // Check cache again (might have been updated by background processes)
      const cachedData = getCachedDataSync();
      if (cachedData) {
        console.log(`[useInstantSoulNetData] Using cached data with ${cachedData.nodes.length} nodes`);
        setGraphData({ nodes: cachedData.nodes, links: cachedData.links });
        preloadedDataRef.current = {
          translations: cachedData.translations,
          connectionPercentages: cachedData.connectionPercentages,
          nodeConnections: preloadedDataRef.current.nodeConnections
        };
        setIsInstantReady(true);
        setLoading(false);
        return;
      }

      // Load fresh data if no cache available
      setLoading(true);
      setError(null);

      const result = await SoulNetPreloadService.preloadSoulNetData(
        userId,
        timeRange,
        currentLanguage
      );

      if (result) {
        console.log(`[useInstantSoulNetData] Successfully loaded fresh data with ${result.nodes.length} nodes`);
        setGraphData({ nodes: result.nodes, links: result.links });
        preloadedDataRef.current = {
          translations: result.translations,
          connectionPercentages: result.connectionPercentages,
          nodeConnections: preloadedDataRef.current.nodeConnections
        };
        setIsInstantReady(true);
      } else {
        console.log('[useInstantSoulNetData] No data returned from preload service');
        setGraphData({ nodes: [], links: [] });
        setIsInstantReady(false);
      }
    } catch (err) {
      console.error('[useInstantSoulNetData] Error loading data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      setIsInstantReady(false);
    } finally {
      setLoading(false);
    }
  }, [userId, timeRange, currentLanguage, getCachedDataSync]);

  // Enhanced language change handler
  useEffect(() => {
    const handleLanguageChange = async (event: CustomEvent) => {
      const newLanguage = event.detail.language;
      console.log(`[useInstantSoulNetData] Language changed to: ${newLanguage}`);
      
      if (userId && newLanguage !== 'en') {
        // Clear old translations and reload for new language
        preloadedDataRef.current.translations.clear();
        setIsInstantReady(false);
        await loadData();
      } else if (newLanguage === 'en') {
        // For English, we don't need translations
        setIsInstantReady(true);
      }
    };

    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [userId, loadData]);

  // Initial data load
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    graphData,
    loading,
    error,
    isInstantReady,
    getInstantTranslation,
    getInstantConnectionPercentage,
    getInstantNodeConnections
  };
};
