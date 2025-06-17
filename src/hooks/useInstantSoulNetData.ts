
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
    console.log(`[useInstantSoulNetData] ENHANCED: Cache key: ${key}`);
    return key;
  }, [userId, timeRange, currentLanguage]);

  // ENHANCED: Comprehensive state initialization
  const [graphData, setGraphData] = useState<{ nodes: NodeData[], links: LinkData[] }>({ nodes: [], links: [] });
  const [translations, setTranslations] = useState<Map<string, string>>(new Map());
  const [connectionPercentages, setConnectionPercentages] = useState<Map<string, number>>(new Map());
  const [nodeConnectionData, setNodeConnectionData] = useState<Map<string, NodeConnectionData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isInstantReady, setIsInstantReady] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);
  const [translationComplete, setTranslationComplete] = useState(false);

  // ENHANCED: Smart parameter change handling
  useEffect(() => {
    console.log(`[useInstantSoulNetData] ENHANCED: Parameters changed - timeRange=${timeRange}, language=${currentLanguage}, userId=${userId}`);
    
    if (!userId) {
      console.log('[useInstantSoulNetData] ENHANCED: No user ID - resetting to empty state');
      setGraphData({ nodes: [], links: [] });
      setTranslations(new Map());
      setConnectionPercentages(new Map());
      setNodeConnectionData(new Map());
      setIsInstantReady(false);
      setTranslationComplete(false);
      setIsTranslating(false);
      setTranslationProgress(0);
      setLoading(false);
      setError(null);
      return;
    }

    // ENHANCED: Immediate cache check for instant response
    const validCache = EnhancedSoulNetPreloadService.getInstantData(cacheKey);
    if (validCache && validCache.data.translationComplete) {
      console.log(`[useInstantSoulNetData] ENHANCED: Found valid cache for ${cacheKey}`);
      
      // Immediate state update with cached data
      setGraphData({ nodes: validCache.data.nodes, links: validCache.data.links });
      setTranslations(validCache.data.translations);
      setConnectionPercentages(validCache.data.connectionPercentages);
      setNodeConnectionData(validCache.data.nodeConnectionData);
      setIsInstantReady(true);
      setTranslationComplete(true);
      setIsTranslating(false);
      setTranslationProgress(100);
      setLoading(false);
      setError(null);
      
      // Smart cache management - only clear others
      EnhancedSoulNetPreloadService.clearTimeRangeCache(userId, timeRange, currentLanguage);
      return;
    }

    // ENHANCED: No valid cache - reset state and prepare for fresh fetch
    console.log(`[useInstantSoulNetData] ENHANCED: No valid cache for ${cacheKey} - preparing fresh fetch`);
    setGraphData({ nodes: [], links: [] });
    setTranslations(new Map());
    setConnectionPercentages(new Map());
    setNodeConnectionData(new Map());
    setIsInstantReady(false);
    setTranslationComplete(false);
    setIsTranslating(false);
    setTranslationProgress(0);
    setLoading(true);
    setError(null);
    
    // Clear other time range caches but preserve node translations
    EnhancedSoulNetPreloadService.clearTimeRangeCache(userId, timeRange, currentLanguage);
    
  }, [userId, timeRange, currentLanguage, cacheKey]);

  // ENHANCED: Fresh data fetching with optimized translation handling
  const fetchFreshData = useCallback(async () => {
    if (!userId || !cacheKey) {
      console.log('[useInstantSoulNetData] ENHANCED: Fetch skip - missing userId or cacheKey');
      setLoading(false);
      return;
    }

    console.log(`[useInstantSoulNetData] ENHANCED: Fetch start for ${cacheKey}`);
    
    // Double-check cache before expensive fetch
    const currentCached = EnhancedSoulNetPreloadService.getInstantData(cacheKey);
    if (currentCached && currentCached.data.translationComplete) {
      console.log(`[useInstantSoulNetData] ENHANCED: Found cache during fetch for ${cacheKey}`);
      setGraphData({ nodes: currentCached.data.nodes, links: currentCached.data.links });
      setTranslations(currentCached.data.translations);
      setConnectionPercentages(currentCached.data.connectionPercentages);
      setNodeConnectionData(currentCached.data.nodeConnectionData);
      setIsInstantReady(true);
      setTranslationComplete(true);
      setIsTranslating(false);
      setTranslationProgress(100);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      
      console.log(`[useInstantSoulNetData] ENHANCED: Fetching fresh data - userId=${userId}, timeRange=${timeRange}, language=${currentLanguage}`);
      
      const result = await EnhancedSoulNetPreloadService.preloadInstantData(
        userId,
        timeRange,
        currentLanguage
      );

      if (result) {
        console.log(`[useInstantSoulNetData] ENHANCED: Fetch success - ${result.nodes.length} nodes, complete=${result.translationComplete}`);
        
        setGraphData({ nodes: result.nodes, links: result.links });
        setTranslations(result.translations);
        setConnectionPercentages(result.connectionPercentages);
        setNodeConnectionData(result.nodeConnectionData);
        setIsInstantReady(true);
        setTranslationComplete(result.translationComplete);
        setIsTranslating(!result.translationComplete);
        setTranslationProgress(result.translationProgress);
      } else {
        console.log('[useInstantSoulNetData] ENHANCED: Fetch empty - no data returned');
        setGraphData({ nodes: [], links: [] });
        setTranslations(new Map());
        setConnectionPercentages(new Map());
        setNodeConnectionData(new Map());
        setIsInstantReady(true);
        setTranslationComplete(true);
        setIsTranslating(false);
        setTranslationProgress(100);
      }
    } catch (err) {
      console.error('[useInstantSoulNetData] ENHANCED: Fetch error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
      setIsTranslating(false);
      setTranslationProgress(100);
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

  // ENHANCED: Optimized getter functions with node cache integration
  const getInstantConnectionPercentage = useCallback((selectedNode: string, targetNode: string): number => {
    if (!selectedNode || selectedNode === targetNode || connectionPercentages.size === 0) return 0;
    
    const key = `${selectedNode}-${targetNode}`;
    return connectionPercentages.get(key) || 0;
  }, [connectionPercentages]);

  const getInstantTranslation = useCallback((nodeId: string): string => {
    if (currentLanguage === 'en') return nodeId;
    
    // ENHANCED: Priority order for translation lookup
    // 1. Completed coordinated translations (highest priority)
    if (translationComplete && translations.size > 0) {
      const coordinatedTranslation = translations.get(nodeId);
      if (coordinatedTranslation) {
        console.log(`[useInstantSoulNetData] Using coordinated translation for ${nodeId}: ${coordinatedTranslation}`);
        return coordinatedTranslation;
      }
    }
    
    // 2. Node-specific cache (second priority)
    const nodeCache = NodeTranslationCacheService.getCachedTranslation(nodeId, currentLanguage);
    if (nodeCache) {
      console.log(`[useInstantSoulNetData] Using node cache for ${nodeId}: ${nodeCache}`);
      return nodeCache;
    }
    
    // 3. Fallback to original (lowest priority)
    console.log(`[useInstantSoulNetData] Using original text for ${nodeId} (no translation available)`);
    return nodeId;
  }, [currentLanguage, translations, translationComplete]);

  const getInstantNodeConnections = useCallback((nodeId: string): NodeConnectionData => {
    return nodeConnectionData.get(nodeId) || {
      connectedNodes: [],
      totalStrength: 0,
      averageStrength: 0
    };
  }, [nodeConnectionData]);

  // ENHANCED: Debug logging with performance metrics
  const debugInfo = useMemo(() => ({
    cacheKey,
    nodesCount: graphData.nodes.length,
    translationsCount: translations.size,
    loading,
    isInstantReady,
    translationComplete,
    isTranslating,
    translationProgress
  }), [cacheKey, graphData.nodes.length, translations.size, loading, isInstantReady, translationComplete, isTranslating, translationProgress]);

  console.log(`[useInstantSoulNetData] ENHANCED STATE:`, debugInfo);

  return {
    graphData,
    translations,
    connectionPercentages,
    nodeConnectionData,
    loading,
    error,
    isInstantReady,
    isTranslating,
    translationProgress,
    translationComplete,
    getInstantConnectionPercentage,
    getInstantTranslation,
    getInstantNodeConnections
  };
};
