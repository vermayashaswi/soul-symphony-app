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
  
  const instantCached = useMemo(() => {
    if (!cacheKey) return null;
    return EnhancedSoulNetPreloadService.getInstantData(cacheKey);
  }, [cacheKey]);

  const [graphData, setGraphData] = useState<{ nodes: NodeData[], links: LinkData[] }>(() => {
    if (instantCached && instantCached.data.translationComplete) {
      console.log('[useInstantSoulNetData] APP-LEVEL: Using complete cached data immediately');
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
  
  // NEW: Translation state tracking
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(100);
  const [translationComplete, setTranslationComplete] = useState(!!(instantCached && instantCached.data.translationComplete));

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

    // Check if we already have complete data
    if (isInstantReady && translationComplete) {
      console.log('[useInstantSoulNetData] APP-LEVEL: Skipping preload - already have complete data');
      setLoading(false);
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
  }, [userId, timeRange, currentLanguage, isInstantReady, translationComplete, cacheKey]);

  // Background preload effect
  useEffect(() => {
    if (!isInstantReady || !translationComplete) {
      preloadData();
    } else {
      setLoading(false);
    }
  }, [preloadData, isInstantReady, translationComplete]);

  // Clear cache when language changes
  useEffect(() => {
    if (userId) {
      console.log('[useInstantSoulNetData] APP-LEVEL: Language changed, clearing cache and resetting state');
      EnhancedSoulNetPreloadService.clearInstantCache(userId);
      setIsInstantReady(false);
      setTranslationComplete(false);
      setIsTranslating(false);
      setTranslationProgress(0);
    }
  }, [currentLanguage, userId]);

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
