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
  // ENHANCED: Atomic translation state tracking
  isTranslating: boolean;
  translationProgress: number;
  translationComplete: boolean;
  isAtomicMode: boolean;
  getInstantConnectionPercentage: (selectedNode: string, targetNode: string) => number;
  getInstantTranslation: (nodeId: string) => string;
  getInstantNodeConnections: (nodeId: string) => NodeConnectionData;
}

export const useInstantSoulNetData = (
  userId: string | undefined,
  timeRange: string
): InstantSoulNetData => {
  const { currentLanguage, getCachedTranslation } = useTranslation();
  
  // ENHANCED: Initialize with atomic cache check
  const cacheKey = useMemo(() => 
    userId ? `${userId}-${timeRange}-${currentLanguage}` : '', 
    [userId, timeRange, currentLanguage]
  );
  
  const instantCached = useMemo(() => {
    if (!cacheKey) return null;
    return EnhancedSoulNetPreloadService.getInstantData(cacheKey);
  }, [cacheKey]);

  // ENHANCED: Atomic state initialization - only use complete atomic data
  const [graphData, setGraphData] = useState<{ nodes: NodeData[], links: LinkData[] }>(() => {
    if (instantCached && instantCached.data.translationComplete) {
      console.log('[useInstantSoulNetData] ATOMIC: Using complete atomic cached data immediately');
      return { nodes: instantCached.data.nodes, links: instantCached.data.links };
    }
    return { nodes: [], links: [] };
  });

  const [translations, setTranslations] = useState<Map<string, string>>(() => {
    return (instantCached && instantCached.data.translationComplete) ? instantCached.data.translations : new Map();
  });

  const [connectionPercentages, setConnectionPercentages] = useState<Map<string, number>>(() => {
    return (instantCached && instantCached.data.translationComplete) ? instantCached.data.connectionPercentages : new Map();
  });

  const [nodeConnectionData, setNodeConnectionData] = useState<Map<string, NodeConnectionData>>(() => {
    return (instantCached && instantCached.data.translationComplete) ? instantCached.data.nodeConnectionData : new Map();
  });

  const [loading, setLoading] = useState(!instantCached || !instantCached.data.translationComplete);
  const [error, setError] = useState<Error | null>(null);
  const [isInstantReady, setIsInstantReady] = useState(!!(instantCached && instantCached.data.translationComplete));
  
  // ENHANCED: Atomic translation state tracking
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(100);
  const [translationComplete, setTranslationComplete] = useState(!!(instantCached && instantCached.data.translationComplete));
  const [isAtomicMode] = useState(true); // Always use atomic mode for consistency

  // ENHANCED: Coordinated translation functions - NEVER re-translate, only retrieve
  const getInstantTranslation = useCallback((nodeId: string): string => {
    if (currentLanguage === 'en') return nodeId;
    
    // ENHANCED: STRICT - Only use atomic translations when complete
    if (translationComplete && isAtomicMode) {
      const atomicTranslation = translations.get(nodeId);
      if (atomicTranslation) {
        console.log(`[useInstantSoulNetData] ATOMIC-STRICT: Got atomic translation for ${nodeId}: ${atomicTranslation}`);
        return atomicTranslation;
      }
    }
    
    // ENHANCED: NO FALLBACK - maintain atomic consistency, always use original text
    console.log(`[useInstantSoulNetData] ATOMIC-STRICT: Using original text for ${nodeId} (atomic: ${isAtomicMode}, complete: ${translationComplete})`);
    return nodeId;
  }, [currentLanguage, translations, translationComplete, isAtomicMode]);

  // ENHANCED: Atomic instant data getter functions
  const getInstantConnectionPercentage = useCallback((selectedNode: string, targetNode: string): number => {
    if (!selectedNode || selectedNode === targetNode) return 0;
    
    const key = `${selectedNode}-${targetNode}`;
    const percentage = connectionPercentages.get(key);
    
    if (percentage !== undefined) {
      console.log(`[useInstantSoulNetData] ATOMIC: Got percentage ${percentage}% for ${key}`);
      return percentage;
    }
    
    console.log(`[useInstantSoulNetData] ATOMIC: No percentage found for ${key}`);
    return 0;
  }, [connectionPercentages]);

  const getInstantNodeConnections = useCallback((nodeId: string): NodeConnectionData => {
    return nodeConnectionData.get(nodeId) || {
      connectedNodes: [],
      totalStrength: 0,
      averageStrength: 0
    };
  }, [nodeConnectionData]);

  // ENHANCED: Atomic background preloading - only load when truly needed
  const preloadData = useCallback(async () => {
    if (!userId) {
      console.log('[useInstantSoulNetData] ATOMIC: Skipping preload - no userId');
      setLoading(false);
      return;
    }

    // ENHANCED: Check if we already have complete atomic data
    if (isInstantReady && translationComplete && isAtomicMode) {
      console.log('[useInstantSoulNetData] ATOMIC: Skipping preload - already have complete atomic data');
      setLoading(false);
      return;
    }

    console.log('[useInstantSoulNetData] ATOMIC: Starting atomic background preload for', userId, timeRange, currentLanguage);
    
    try {
      setError(null);
      
      // ENHANCED: Get atomic translation state
      const translationState = EnhancedSoulNetPreloadService.getTranslationState(cacheKey);
      setIsTranslating(translationState.isTranslating);
      setTranslationProgress(translationState.progress);
      
      const result = await EnhancedSoulNetPreloadService.preloadInstantData(
        userId,
        timeRange,
        currentLanguage
      );

      if (result) {
        console.log('[useInstantSoulNetData] ATOMIC: Background atomic preload successful', {
          nodes: result.nodes.length,
          translationComplete: result.translationComplete,
          translationProgress: result.translationProgress
        });
        
        // ENHANCED: Only update UI state if atomic translation is complete
        if (result.translationComplete) {
          setGraphData({ nodes: result.nodes, links: result.links });
          setTranslations(result.translations);
          setConnectionPercentages(result.connectionPercentages);
          setNodeConnectionData(result.nodeConnectionData);
          setIsInstantReady(true);
          setTranslationComplete(true);
        } else {
          // ENHANCED: Keep showing loading state until atomic translation is complete
          console.log('[useInstantSoulNetData] ATOMIC: Translation not complete, maintaining atomic loading state');
        }
        
        setIsTranslating(false);
        setTranslationProgress(result.translationProgress);
      } else {
        console.log('[useInstantSoulNetData] ATOMIC: No data returned from atomic background preload');
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
      console.error('[useInstantSoulNetData] ATOMIC: Background atomic preload error:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      setIsTranslating(false);
      setTranslationProgress(100);
    } finally {
      setLoading(false);
    }
  }, [userId, timeRange, currentLanguage, isInstantReady, translationComplete, isAtomicMode, cacheKey]);

  // Background preload effect
  useEffect(() => {
    if (!isInstantReady || !translationComplete) {
      preloadData();
    } else {
      setLoading(false);
    }
  }, [preloadData, isInstantReady, translationComplete]);

  // ENHANCED: Clear cache when language changes with atomic coordination
  useEffect(() => {
    if (userId) {
      console.log('[useInstantSoulNetData] ATOMIC: Language changed, clearing atomic cache and resetting state');
      EnhancedSoulNetPreloadService.clearInstantCache(userId);
      setIsInstantReady(false);
      setTranslationComplete(false);
      setIsTranslating(false);
      setTranslationProgress(0);
    }
  }, [currentLanguage, userId]);

  console.log(`[useInstantSoulNetData] ATOMIC STATE: nodes=${graphData.nodes.length}, translations=${translations.size}, percentages=${connectionPercentages.size}, instantReady=${isInstantReady}, loading=${loading}, translating=${isTranslating}, progress=${translationProgress}%, complete=${translationComplete}, atomic=${isAtomicMode}`);

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
    isAtomicMode,
    getInstantConnectionPercentage,
    getInstantTranslation,
    getInstantNodeConnections
  };
};
