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
  // NEW: Translation state tracking
  isTranslating: boolean;
  translationProgress: number;
  translationComplete: boolean;
  // Add the getter methods to the interface
  getInstantConnectionPercentage: (selectedNode: string, targetNode: string) => number;
  getInstantTranslation: (nodeId: string) => string;
  getInstantNodeConnections: (nodeId: string) => NodeConnectionData;
}

export const useInstantSoulNetData = (
  userId: string | undefined,
  timeRange: string
): InstantSoulNetData => {
  const { currentLanguage, getCachedTranslation } = useTranslation();
  
  // Initialize with instant check for cached data
  const cacheKey = useMemo(() => 
    userId ? `${userId}-${timeRange}-${currentLanguage}` : '', 
    [userId, timeRange, currentLanguage]
  );

  // Defensive: Always read from cache after reset, so define a getter
  const instantCached = useMemo(() => {
    if (!cacheKey) return null;
    return EnhancedSoulNetPreloadService.getInstantData(cacheKey);
  }, [cacheKey]);

  // ------------------
  // ENHANCED: manage resetting state and cache clearing order/logic
  // ------------------
  // Defensive: Use state AND ensure initial state doesn't reflect any old cache after reset
  const [graphData, setGraphData] = useState<{ nodes: NodeData[], links: LinkData[] }>(
    () => (instantCached && instantCached.data.translationComplete)
      ? { nodes: instantCached.data.nodes, links: instantCached.data.links }
      : { nodes: [], links: [] }
  );
  const [translations, setTranslations] = useState<Map<string, string>>(
    () => (instantCached && instantCached.data.translationComplete)
      ? instantCached.data.translations : new Map()
  );
  const [connectionPercentages, setConnectionPercentages] = useState<Map<string, number>>(
    () => (instantCached && instantCached.data.translationComplete)
      ? instantCached.data.connectionPercentages : new Map()
  );
  const [nodeConnectionData, setNodeConnectionData] = useState<Map<string, NodeConnectionData>>(
    () => (instantCached && instantCached.data.translationComplete)
      ? instantCached.data.nodeConnectionData : new Map()
  );
  const [loading, setLoading] = useState(!instantCached || !instantCached.data.translationComplete);
  const [error, setError] = useState<Error | null>(null);
  const [isInstantReady, setIsInstantReady] = useState(!!(instantCached && instantCached.data.translationComplete));
  // Translation state tracking
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(100);
  const [translationComplete, setTranslationComplete] = useState(!!(instantCached && instantCached.data.translationComplete));

  // Manual state reset tracking (to block race)
  const [cacheResetFlag, setCacheResetFlag] = useState(0);

  // ENHANCED EFFECT: Instead of resetting state before, clear cache FIRST, then reset; then update the cache key
  useEffect(() => {
    if (!userId) return; // nothing to clear/reset without userId
    // Step 1: clear cache for old (stale) time ranges before changing state
    EnhancedSoulNetPreloadService.clearTimeRangeCache(userId, timeRange, currentLanguage);
    // Step 2: once cleared (synchronous), reset flag to force below effect
    setCacheResetFlag(flag => flag + 1);
    // This will re-populate state from new cache, if any
    console.log('[useInstantSoulNetData] ENHANCED: Cleared cache and triggered reset for', cacheKey);
  // Only run if any of these key routing state changes
  }, [timeRange, currentLanguage, userId]);

  // ENHANCED: after cache is cleared, reset state in a controlled effect so there's no race
  useEffect(() => {
    // Always validate immediately after cache clearing. This effect is triggered by cacheResetFlag changing.
    const recached = cacheKey ? EnhancedSoulNetPreloadService.getInstantData(cacheKey) : null;
    if (recached && recached.data.translationComplete) {
      // Valid cache found, hydrate state from it
      setGraphData({ nodes: recached.data.nodes, links: recached.data.links });
      setTranslations(recached.data.translations);
      setConnectionPercentages(recached.data.connectionPercentages);
      setNodeConnectionData(recached.data.nodeConnectionData);
      setIsInstantReady(true);
      setTranslationComplete(true);
      setIsTranslating(false);
      setTranslationProgress(100);
      setLoading(false);
      setError(null);
      console.log('[useInstantSoulNetData] ENHANCED: Immediately hydrated state from valid cache after reset', cacheKey);
    } else {
      // No valid cache, wipe state
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
      console.log('[useInstantSoulNetData] ENHANCED: State cleared (no valid cache after reset)', cacheKey);
    }
  // Only run after cacheResetFlag changes (decoupled from timeRange/userId directly)
  }, [cacheResetFlag, cacheKey]);

  // APP-LEVEL: Enhanced instant data getter functions using app-level translation service
  const getInstantConnectionPercentage = useCallback((selectedNode: string, targetNode: string): number => {
    if (!selectedNode || selectedNode === targetNode) return 0;
    
    const key = `${selectedNode}-${targetNode}`;
    const percentage = connectionPercentages.get(key);
    
    if (percentage !== undefined) {
      console.log(`[useInstantSoulNetData] APP-LEVEL: Got percentage ${percentage}% for ${key}`);
      return percentage;
    }
    
    console.log(`[useInstantSoulNetData] APP-LEVEL: No percentage found for ${key}`);
    return 0;
  }, [connectionPercentages]);

  const getInstantTranslation = useCallback((nodeId: string): string => {
    if (currentLanguage === 'en') return nodeId;
    
    // Only use translations if translation is complete to avoid partial states
    if (translationComplete) {
      const coordinatedTranslation = translations.get(nodeId);
      if (coordinatedTranslation) {
        console.log(`[useInstantSoulNetData] APP-LEVEL: Got coordinated translation for ${nodeId}: ${coordinatedTranslation}`);
        return coordinatedTranslation;
      }
    }
    
    // APP-LEVEL: Fallback to app-level translation cache only if translation is not in progress
    if (!isTranslating) {
      const appLevelTranslation = getCachedTranslation(nodeId);
      if (appLevelTranslation) {
        console.log(`[useInstantSoulNetData] APP-LEVEL: Got app-level cached translation for ${nodeId}: ${appLevelTranslation}`);
        return appLevelTranslation;
      }
    }
    
    // Show original text during translation to avoid mixed states
    console.log(`[useInstantSoulNetData] APP-LEVEL: Using original text for ${nodeId} (translating: ${isTranslating}, complete: ${translationComplete})`);
    return nodeId;
  }, [currentLanguage, translations, getCachedTranslation, translationComplete, isTranslating]);

  const getInstantNodeConnections = useCallback((nodeId: string): NodeConnectionData => {
    return nodeConnectionData.get(nodeId) || {
      connectedNodes: [],
      totalStrength: 0,
      averageStrength: 0
    };
  }, [nodeConnectionData]);

  // Enhanced background preloading with translation state tracking
  const preloadData = useCallback(async () => {
    if (!userId) {
      console.log('[useInstantSoulNetData] APP-LEVEL: Skipping preload - no userId');
      setLoading(false);
      return;
    }

    // Defensive: Always check for valid cache after state reset and before loading
    const currentCached = EnhancedSoulNetPreloadService.getInstantData(cacheKey);
    if (currentCached && currentCached.data.translationComplete) {
      setGraphData({ nodes: currentCached.data.nodes, links: currentCached.data.links });
      setTranslations(currentCached.data.translations);
      setConnectionPercentages(currentCached.data.connectionPercentages);
      setNodeConnectionData(currentCached.data.nodeConnectionData);
      setIsInstantReady(true);
      setTranslationComplete(true);
      setIsTranslating(false);
      setTranslationProgress(100);
      setLoading(false);
      setError(null);
      console.log('[useInstantSoulNetData] APP-LEVEL: preloadData found new valid cache after reset', cacheKey);
      return;
    }

    console.log('[useInstantSoulNetData] APP-LEVEL: Starting background preload for', userId, timeRange, currentLanguage);
    
    try {
      setError(null);
      
      // Get translation state
      const translationState = EnhancedSoulNetPreloadService.getTranslationState(cacheKey);
      setIsTranslating(translationState.isTranslating);
      setTranslationProgress(translationState.progress);
      
      const result = await EnhancedSoulNetPreloadService.preloadInstantData(
        userId,
        timeRange,
        currentLanguage
      );

      if (result) {
        console.log('[useInstantSoulNetData] APP-LEVEL: Background preload successful', {
          nodes: result.nodes.length,
          translationComplete: result.translationComplete,
          translationProgress: result.translationProgress
        });
        
        // Only update UI state if translation is complete
        if (result.translationComplete) {
          setGraphData({ nodes: result.nodes, links: result.links });
          setTranslations(result.translations);
          setConnectionPercentages(result.connectionPercentages);
          setNodeConnectionData(result.nodeConnectionData);
          setIsInstantReady(true);
          setTranslationComplete(true);
        } else {
          // Keep showing loading state until translation is complete
          console.log('[useInstantSoulNetData] APP-LEVEL: Translation not complete, maintaining loading state');
        }
        
        setIsTranslating(false);
        setTranslationProgress(result.translationProgress);
      } else {
        console.log('[useInstantSoulNetData] APP-LEVEL: No data returned from background preload');
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
      console.error('[useInstantSoulNetData] APP-LEVEL: Background preload error:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      setIsTranslating(false);
      setTranslationProgress(100);
    } finally {
      setLoading(false);
    }
  }, [userId, timeRange, currentLanguage, cacheKey]);

  // Background preload effect after cache and state are initialized
  useEffect(() => {
    preloadData();
  }, [preloadData, cacheResetFlag]);

  console.log(`[useInstantSoulNetData] APP-LEVEL STATE: nodes=${graphData.nodes.length}, translations=${translations.size}, percentages=${connectionPercentages.size}, instantReady=${isInstantReady}, loading=${loading}, translating=${isTranslating}, progress=${translationProgress}%, complete=${translationComplete}`);

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
