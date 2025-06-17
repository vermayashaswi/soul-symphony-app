import { useState, useEffect, useCallback, useMemo } from 'react';
import { EnhancedSoulNetPreloadService } from '@/services/enhancedSoulNetPreloadService';
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
  timeRange: string,
  globalDate?: Date
): InstantSoulNetData => {
  const { currentLanguage, getCachedTranslation } = useTranslation();
  
  // ENHANCED: Cache key with global date dependency
  const cacheKey = useMemo(() => {
    if (!userId) return '';
    const dateStr = globalDate ? globalDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const key = `${userId}-${timeRange}-${currentLanguage}-${dateStr}`;
    console.log(`[useInstantSoulNetData] CACHE KEY: ${key}`);
    return key;
  }, [userId, timeRange, currentLanguage, globalDate]);

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

  // ENHANCED: Parameter change tracking with global date
  useEffect(() => {
    console.log(`[useInstantSoulNetData] PARAMETERS CHANGED: timeRange=${timeRange}, language=${currentLanguage}, userId=${userId}, globalDate=${globalDate?.toISOString()}`);
    
    if (!userId) {
      console.log('[useInstantSoulNetData] NO USER ID - resetting to empty state');
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

    // STEP 1: Immediate state reset to prevent stale data display
    console.log('[useInstantSoulNetData] RESETTING STATE for fresh data');
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

    // STEP 2: Clear other time range caches immediately
    console.log(`[useInstantSoulNetData] CLEARING OTHER CACHES: keeping ${timeRange} for ${currentLanguage}`);
    EnhancedSoulNetPreloadService.clearTimeRangeCache(userId, timeRange, currentLanguage);

    // STEP 3: Check for valid cache after clearing others
    const validCache = EnhancedSoulNetPreloadService.getInstantData(cacheKey);
    if (validCache && validCache.data.translationComplete) {
      console.log(`[useInstantSoulNetData] FOUND VALID CACHE: ${cacheKey}`);
      setGraphData({ nodes: validCache.data.nodes, links: validCache.data.links });
      setTranslations(validCache.data.translations);
      setConnectionPercentages(validCache.data.connectionPercentages);
      setNodeConnectionData(validCache.data.nodeConnectionData);
      setIsInstantReady(true);
      setTranslationComplete(true);
      setIsTranslating(false);
      setTranslationProgress(100);
      setLoading(false);
    } else {
      console.log(`[useInstantSoulNetData] NO VALID CACHE: will fetch fresh data for ${cacheKey}`);
    }
  }, [userId, timeRange, currentLanguage, globalDate, cacheKey]);

  // ENHANCED: Fresh data fetching with global date support
  const fetchFreshData = useCallback(async () => {
    if (!userId || !cacheKey) {
      console.log('[useInstantSoulNetData] FETCH SKIP: missing userId or cacheKey');
      setLoading(false);
      return;
    }

    console.log(`[useInstantSoulNetData] FETCH START: ${cacheKey}`);
    
    // Double-check cache before expensive fetch
    const currentCached = EnhancedSoulNetPreloadService.getInstantData(cacheKey);
    if (currentCached && currentCached.data.translationComplete) {
      console.log(`[useInstantSoulNetData] FETCH SKIP: found valid cache ${cacheKey}`);
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
      
      console.log(`[useInstantSoulNetData] FETCHING FRESH: userId=${userId}, timeRange=${timeRange}, language=${currentLanguage}, globalDate=${globalDate?.toISOString()}`);
      
      const result = await EnhancedSoulNetPreloadService.preloadInstantData(
        userId,
        timeRange,
        currentLanguage,
        globalDate
      );

      if (result) {
        console.log(`[useInstantSoulNetData] FETCH SUCCESS: ${result.nodes.length} nodes, complete=${result.translationComplete}`);
        
        setGraphData({ nodes: result.nodes, links: result.links });
        setTranslations(result.translations);
        setConnectionPercentages(result.connectionPercentages);
        setNodeConnectionData(result.nodeConnectionData);
        setIsInstantReady(true);
        setTranslationComplete(result.translationComplete);
        setIsTranslating(!result.translationComplete);
        setTranslationProgress(result.translationProgress);
      } else {
        console.log('[useInstantSoulNetData] FETCH EMPTY: no data for current parameters');
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
      console.error('[useInstantSoulNetData] FETCH ERROR:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
      setIsTranslating(false);
      setTranslationProgress(100);
    } finally {
      setLoading(false);
    }
  }, [userId, timeRange, currentLanguage, globalDate, cacheKey]);

  // Trigger data fetching
  useEffect(() => {
    fetchFreshData();
  }, [fetchFreshData]);

  // ENHANCED: Optimized getter functions
  const getInstantConnectionPercentage = useCallback((selectedNode: string, targetNode: string): number => {
    if (!selectedNode || selectedNode === targetNode || connectionPercentages.size === 0) return 0;
    
    const key = `${selectedNode}-${targetNode}`;
    return connectionPercentages.get(key) || 0;
  }, [connectionPercentages]);

  const getInstantTranslation = useCallback((nodeId: string): string => {
    if (currentLanguage === 'en') return nodeId;
    
    // Priority: completed translations > app-level cache > fallback
    if (translationComplete) {
      const coordinatedTranslation = translations.get(nodeId);
      if (coordinatedTranslation) return coordinatedTranslation;
    }
    
    if (!isTranslating) {
      const appLevelTranslation = getCachedTranslation(nodeId);
      if (appLevelTranslation) return appLevelTranslation;
    }
    
    return nodeId;
  }, [currentLanguage, translations, getCachedTranslation, translationComplete, isTranslating]);

  const getInstantNodeConnections = useCallback((nodeId: string): NodeConnectionData => {
    return nodeConnectionData.get(nodeId) || {
      connectedNodes: [],
      totalStrength: 0,
      averageStrength: 0
    };
  }, [nodeConnectionData]);

  // ENHANCED: Comprehensive debug logging
  console.log(`[useInstantSoulNetData] STATE: key=${cacheKey}, nodes=${graphData.nodes.length}, loading=${loading}, ready=${isInstantReady}, complete=${translationComplete}, translating=${isTranslating}`);

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
