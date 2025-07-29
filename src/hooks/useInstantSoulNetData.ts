
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
  timeRange: string
): InstantSoulNetData => {
  const { currentLanguage, getCachedTranslation } = useTranslation();
  
  // ENHANCED: Cache key with proper dependency tracking
  const cacheKey = useMemo(() => {
    if (!userId) return '';
    const key = `${userId}-${timeRange}-${currentLanguage}`;
    console.log(`[useInstantSoulNetData] CACHE KEY: ${key}`);
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

  // ENHANCED: Immediate state reset and cache management when parameters change
  useEffect(() => {
    console.log(`[useInstantSoulNetData] PARAMETERS CHANGED: timeRange=${timeRange}, language=${currentLanguage}, userId=${userId}`);
    
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
  }, [userId, timeRange, currentLanguage, cacheKey]);

  // ENHANCED: Fresh data fetching with comprehensive error handling
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
      
      console.log(`[useInstantSoulNetData] FETCHING FRESH: userId=${userId}, timeRange=${timeRange}, language=${currentLanguage}`);
      
      const result = await EnhancedSoulNetPreloadService.preloadInstantData(
        userId,
        timeRange,
        currentLanguage
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
  }, [userId, timeRange, currentLanguage]); // Removed cacheKey to prevent loops

  // Trigger data fetching with improved dependency management
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      if (!isMounted) return;
      await fetchFreshData();
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [userId, timeRange, currentLanguage]); // Remove fetchFreshData from deps to prevent loops

  // ENHANCED: Optimized getter functions with better debugging
  const getInstantConnectionPercentage = useCallback((selectedNode: string, targetNode: string): number => {
    if (!selectedNode || selectedNode === targetNode) {
      console.log(`[useInstantSoulNetData] PERCENTAGE: Invalid input - selectedNode=${selectedNode}, targetNode=${targetNode}`);
      return 0;
    }
    
    if (connectionPercentages.size === 0) {
      console.log(`[useInstantSoulNetData] PERCENTAGE: No connection percentages loaded yet`);
      return 0;
    }
    
    const key = `${selectedNode}-${targetNode}`;
    const percentage = connectionPercentages.get(key) || 0;
    console.log(`[useInstantSoulNetData] PERCENTAGE: ${key} = ${percentage}%`);
    
    // Also try reverse direction if no direct match
    if (percentage === 0) {
      const reverseKey = `${targetNode}-${selectedNode}`;
      const reversePercentage = connectionPercentages.get(reverseKey) || 0;
      console.log(`[useInstantSoulNetData] PERCENTAGE: Reverse check ${reverseKey} = ${reversePercentage}%`);
      return reversePercentage;
    }
    
    return percentage;
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
