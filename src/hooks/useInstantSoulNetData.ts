
import { useState, useEffect, useCallback, useMemo } from 'react';
import { EnhancedSoulNetPreloadService } from '@/services/enhancedSoulNetPreloadService';
import { NodeTranslationCacheService } from '@/services/nodeTranslationCacheService';
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

interface NodeConnectionData {
  connectedNodes: string[];
  totalStrength: number;
  averageStrength: number;
}

interface InstantSoulNetData {
  graphData: { nodes: NodeData[], links: LinkData[] };
  translations: Map<string, string>;
  connectionPercentages: Map<string, number>;
  nodeConnectionData: Map<string, NodeConnectionData>;
  loading: boolean;
  error: Error | null;
  isInstantReady: boolean;
  isTranslating: boolean;
  translationProgress: number;
  translationComplete: boolean;
  getInstantConnectionPercentage: (selectedNode: string, targetNode: string) => number;
  getInstantTranslation: (nodeId: string) => string;
  getInstantNodeConnections: (nodeId: string) => NodeConnectionData;
}

export const useInstantSoulNetData = (
  userId: string | undefined,
  timeRange: string
): InstantSoulNetData => {
  const { currentLanguage } = useTranslation();
  
  // ENHANCED: Stable cache key management
  const cacheKey = useMemo(() => {
    if (!userId) return '';
    const key = `${userId}-${timeRange}-${currentLanguage}`;
    console.log(`[useInstantSoulNetData] STREAMLINED: Cache key: ${key}`);
    return key;
  }, [userId, timeRange, currentLanguage]);

  // STREAMLINED: Simplified state initialization
  const [graphData, setGraphData] = useState<{ nodes: NodeData[], links: LinkData[] }>({ nodes: [], links: [] });
  const [translations, setTranslations] = useState<Map<string, string>>(new Map());
  const [connectionPercentages, setConnectionPercentages] = useState<Map<string, number>>(new Map());
  const [nodeConnectionData, setNodeConnectionData] = useState<Map<string, NodeConnectionData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isInstantReady, setIsInstantReady] = useState(false);

  // STREAMLINED: Remove individual translation state - only track completion
  const [translationComplete, setTranslationComplete] = useState(false);

  // ENHANCED: Smart parameter change handling with instant cache check
  useEffect(() => {
    console.log(`[useInstantSoulNetData] STREAMLINED: Parameters changed - timeRange=${timeRange}, language=${currentLanguage}, userId=${userId}`);
    
    if (!userId) {
      console.log('[useInstantSoulNetData] STREAMLINED: No user ID - resetting to empty state');
      setGraphData({ nodes: [], links: [] });
      setTranslations(new Map());
      setConnectionPercentages(new Map());
      setNodeConnectionData(new Map());
      setIsInstantReady(false);
      setTranslationComplete(false);
      setLoading(false);
      setError(null);
      return;
    }

    // ENHANCED: Immediate cache check for instant response
    const validCache = EnhancedSoulNetPreloadService.getInstantData(cacheKey);
    if (validCache && validCache.data.translationComplete) {
      console.log(`[useInstantSoulNetData] STREAMLINED: Found complete cache for ${cacheKey} - INSTANT LOAD`);
      
      // Immediate state update with cached data - NO LOADING STATE
      setGraphData({ nodes: validCache.data.nodes, links: validCache.data.links });
      setTranslations(validCache.data.translations);
      setConnectionPercentages(validCache.data.connectionPercentages);
      setNodeConnectionData(validCache.data.nodeConnectionData);
      setIsInstantReady(true);
      setTranslationComplete(true);
      setLoading(false);
      setError(null);
      
      // Smart cache management
      EnhancedSoulNetPreloadService.clearTimeRangeCache(userId, timeRange, currentLanguage);
      return;
    }

    // STREAMLINED: No valid cache - reset state cleanly
    console.log(`[useInstantSoulNetData] STREAMLINED: No complete cache for ${cacheKey} - preparing fresh fetch`);
    setGraphData({ nodes: [], links: [] });
    setTranslations(new Map());
    setConnectionPercentages(new Map());
    setNodeConnectionData(new Map());
    setIsInstantReady(false);
    setTranslationComplete(false);
    setLoading(true);
    setError(null);
    
    // Clear other caches
    EnhancedSoulNetPreloadService.clearTimeRangeCache(userId, timeRange, currentLanguage);
    
  }, [userId, timeRange, currentLanguage, cacheKey]);

  // STREAMLINED: Fresh data fetching with optimized flow
  const fetchFreshData = useCallback(async () => {
    if (!userId || !cacheKey) {
      console.log('[useInstantSoulNetData] STREAMLINED: Fetch skip - missing userId or cacheKey');
      setLoading(false);
      return;
    }

    console.log(`[useInstantSoulNetData] STREAMLINED: Fetch start for ${cacheKey}`);
    
    // Double-check cache before expensive fetch
    const currentCached = EnhancedSoulNetPreloadService.getInstantData(cacheKey);
    if (currentCached && currentCached.data.translationComplete) {
      console.log(`[useInstantSoulNetData] STREAMLINED: Found cache during fetch for ${cacheKey}`);
      setGraphData({ nodes: currentCached.data.nodes, links: currentCached.data.links });
      setTranslations(currentCached.data.translations);
      setConnectionPercentages(currentCached.data.connectionPercentages);
      setNodeConnectionData(currentCached.data.nodeConnectionData);
      setIsInstantReady(true);
      setTranslationComplete(true);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      
      console.log(`[useInstantSoulNetData] STREAMLINED: Fetching fresh data - userId=${userId}, timeRange=${timeRange}, language=${currentLanguage}`);
      
      const result = await EnhancedSoulNetPreloadService.preloadInstantData(
        userId,
        timeRange,
        currentLanguage
      );

      if (result) {
        console.log(`[useInstantSoulNetData] STREAMLINED: Fetch success - ${result.nodes.length} nodes, complete=${result.translationComplete}`);
        
        setGraphData({ nodes: result.nodes, links: result.links });
        setTranslations(result.translations);
        setConnectionPercentages(result.connectionPercentages);
        setNodeConnectionData(result.nodeConnectionData);
        setIsInstantReady(true);
        setTranslationComplete(result.translationComplete);
      } else {
        console.log('[useInstantSoulNetData] STREAMLINED: Fetch empty - no data returned');
        setGraphData({ nodes: [], links: [] });
        setTranslations(new Map());
        setConnectionPercentages(new Map());
        setNodeConnectionData(new Map());
        setIsInstantReady(true);
        setTranslationComplete(true);
      }
    } catch (err) {
      console.error('[useInstantSoulNetData] STREAMLINED: Fetch error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setLoading(false);
    }
  }, [userId, timeRange, currentLanguage, cacheKey]);

  // Trigger data fetching when needed
  useEffect(() => {
    // Only fetch if we don't have valid cached data
    const currentCached = EnhancedSoulNetPreloadService.getInstantData(cacheKey);
    if (!currentCached || !currentCached.data.translationComplete) {
      fetchFreshData();
    }
  }, [fetchFreshData, cacheKey]);

  // ENHANCED: Optimized getter functions with coordinated translations
  const getInstantConnectionPercentage = useCallback((selectedNode: string, targetNode: string): number => {
    if (!selectedNode || selectedNode === targetNode || connectionPercentages.size === 0) return 0;
    
    const key = `${selectedNode}-${targetNode}`;
    return connectionPercentages.get(key) || 0;
  }, [connectionPercentages]);

  const getInstantTranslation = useCallback((nodeId: string): string => {
    if (currentLanguage === 'en') return nodeId;
    
    // STREAMLINED: Priority order for translation lookup
    // 1. Coordinated translations (highest priority - no loading)
    if (translationComplete && translations.size > 0) {
      const coordinatedTranslation = translations.get(nodeId);
      if (coordinatedTranslation) {
        console.log(`[useInstantSoulNetData] STREAMLINED: Using coordinated translation for ${nodeId}: ${coordinatedTranslation}`);
        return coordinatedTranslation;
      }
    }
    
    // 2. Node cache (second priority - instant)
    const nodeCache = NodeTranslationCacheService.getCachedTranslation(nodeId, currentLanguage);
    if (nodeCache) {
      console.log(`[useInstantSoulNetData] STREAMLINED: Using node cache for ${nodeId}: ${nodeCache}`);
      return nodeCache;
    }
    
    // 3. Fallback to original (no loading state)
    console.log(`[useInstantSoulNetData] STREAMLINED: Using original text for ${nodeId}`);
    return nodeId;
  }, [currentLanguage, translations, translationComplete]);

  const getInstantNodeConnections = useCallback((nodeId: string): NodeConnectionData => {
    return nodeConnectionData.get(nodeId) || {
      connectedNodes: [],
      totalStrength: 0,
      averageStrength: 0
    };
  }, [nodeConnectionData]);

  return {
    graphData,
    translations,
    connectionPercentages,
    nodeConnectionData,
    loading,
    error,
    isInstantReady,
    isTranslating: false, // STREAMLINED: No individual translation loading
    translationProgress: translationComplete ? 100 : 0, // STREAMLINED: Binary progress
    translationComplete,
    getInstantConnectionPercentage,
    getInstantTranslation,
    getInstantNodeConnections
  };
};
