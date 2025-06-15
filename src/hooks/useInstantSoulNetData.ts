
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
  
  // FIXED: Generate cache key with proper invalidation tracking
  const cacheKey = useMemo(() => {
    if (!userId) return '';
    const key = `${userId}-${timeRange}-${currentLanguage}`;
    console.log(`[useInstantSoulNetData] CACHE KEY GENERATION: ${key}`);
    return key;
  }, [userId, timeRange, currentLanguage]);

  // DEFENSIVE: Initialize state with empty values
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

  // FIXED: Immediate cache invalidation and state reset when parameters change
  useEffect(() => {
    console.log(`[useInstantSoulNetData] PARAMETER CHANGE DETECTED: ${timeRange}, ${currentLanguage}`);
    
    if (!userId) {
      console.log('[useInstantSoulNetData] No userId, clearing state');
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

    // STEP 1: Clear old cache immediately
    console.log(`[useInstantSoulNetData] CLEARING OLD CACHE for user: ${userId}, keeping only: ${timeRange}`);
    EnhancedSoulNetPreloadService.clearTimeRangeCache(userId, timeRange, currentLanguage);
    
    // STEP 2: Reset state immediately to prevent stale data display
    console.log('[useInstantSoulNetData] RESETTING STATE to prevent stale data');
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

    // STEP 3: Check for valid cache after clearing
    const freshCache = EnhancedSoulNetPreloadService.getInstantData(cacheKey);
    if (freshCache && freshCache.data.translationComplete) {
      console.log(`[useInstantSoulNetData] FOUND FRESH CACHE after clearing: ${cacheKey}`);
      setGraphData({ nodes: freshCache.data.nodes, links: freshCache.data.links });
      setTranslations(freshCache.data.translations);
      setConnectionPercentages(freshCache.data.connectionPercentages);
      setNodeConnectionData(freshCache.data.nodeConnectionData);
      setIsInstantReady(true);
      setTranslationComplete(true);
      setIsTranslating(false);
      setTranslationProgress(100);
      setLoading(false);
    } else {
      console.log(`[useInstantSoulNetData] NO FRESH CACHE found for: ${cacheKey}, will fetch new data`);
    }
  }, [userId, timeRange, currentLanguage, cacheKey]);

  // Data fetching with comprehensive logging
  const preloadData = useCallback(async () => {
    if (!userId || !cacheKey) {
      console.log('[useInstantSoulNetData] SKIPPING PRELOAD - missing userId or cacheKey');
      setLoading(false);
      return;
    }

    console.log(`[useInstantSoulNetData] STARTING PRELOAD for: ${cacheKey}`);
    
    // Double-check cache before fetching
    const currentCached = EnhancedSoulNetPreloadService.getInstantData(cacheKey);
    if (currentCached && currentCached.data.translationComplete) {
      console.log(`[useInstantSoulNetData] PRELOAD FOUND VALID CACHE: ${cacheKey}`);
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
      
      console.log(`[useInstantSoulNetData] FETCHING NEW DATA for: userId=${userId}, timeRange=${timeRange}, language=${currentLanguage}`);
      
      const result = await EnhancedSoulNetPreloadService.preloadInstantData(
        userId,
        timeRange,
        currentLanguage
      );

      if (result) {
        console.log(`[useInstantSoulNetData] FETCH SUCCESS: ${result.nodes.length} nodes, translationComplete: ${result.translationComplete}`);
        
        if (result.translationComplete) {
          setGraphData({ nodes: result.nodes, links: result.links });
          setTranslations(result.translations);
          setConnectionPercentages(result.connectionPercentages);
          setNodeConnectionData(result.nodeConnectionData);
          setIsInstantReady(true);
          setTranslationComplete(true);
        } else {
          console.log('[useInstantSoulNetData] TRANSLATION NOT COMPLETE, maintaining loading state');
        }
        
        setIsTranslating(false);
        setTranslationProgress(result.translationProgress);
      } else {
        console.log('[useInstantSoulNetData] FETCH RETURNED NULL - no data for this time range');
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
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      setIsTranslating(false);
      setTranslationProgress(100);
    } finally {
      setLoading(false);
    }
  }, [userId, timeRange, currentLanguage, cacheKey]);

  // Trigger data fetching
  useEffect(() => {
    preloadData();
  }, [preloadData]);

  // Instant getter functions with enhanced logging
  const getInstantConnectionPercentage = useCallback((selectedNode: string, targetNode: string): number => {
    if (!selectedNode || selectedNode === targetNode) return 0;
    
    const key = `${selectedNode}-${targetNode}`;
    const percentage = connectionPercentages.get(key);
    
    if (percentage !== undefined) {
      console.log(`[useInstantSoulNetData] CONNECTION PERCENTAGE: ${percentage}% for ${key}`);
      return percentage;
    }
    
    return 0;
  }, [connectionPercentages]);

  const getInstantTranslation = useCallback((nodeId: string): string => {
    if (currentLanguage === 'en') return nodeId;
    
    if (translationComplete) {
      const coordinatedTranslation = translations.get(nodeId);
      if (coordinatedTranslation) {
        return coordinatedTranslation;
      }
    }
    
    if (!isTranslating) {
      const appLevelTranslation = getCachedTranslation(nodeId);
      if (appLevelTranslation) {
        return appLevelTranslation;
      }
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

  // COMPREHENSIVE DEBUG LOGGING
  console.log(`[useInstantSoulNetData] STATE SUMMARY: cacheKey=${cacheKey}, nodes=${graphData.nodes.length}, loading=${loading}, isInstantReady=${isInstantReady}, translationComplete=${translationComplete}`);

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
