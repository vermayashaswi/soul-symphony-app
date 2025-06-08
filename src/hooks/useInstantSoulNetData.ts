
import { useState, useEffect, useCallback, useMemo } from 'react';
import { EnhancedSoulNetPreloadService } from '@/services/enhancedSoulNetPreloadService';
import { useTranslation } from '@/contexts/TranslationContext';
import { translationStateManager } from '@/services/translationStateManager';

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
  // Add the getter methods to the interface
  getInstantConnectionPercentage: (selectedNode: string, targetNode: string) => number;
  getInstantTranslation: (nodeId: string) => string;
  getInstantNodeConnections: (nodeId: string) => NodeConnectionData;
}

export const useInstantSoulNetData = (
  userId: string | undefined,
  timeRange: string
): InstantSoulNetData => {
  const { currentLanguage } = useTranslation();
  
  // COORDINATED CACHE KEY: Include coordinator ID for better cache validation
  const cacheKey = useMemo(() => {
    const coordinatorId = translationStateManager.getState().coordinatorId;
    return userId ? `${userId}-${timeRange}-${currentLanguage}-${coordinatorId}` : '';
  }, [userId, timeRange, currentLanguage]);
  
  const instantCached = useMemo(() => {
    if (!cacheKey) return null;
    const cached = EnhancedSoulNetPreloadService.getInstantData(cacheKey);
    console.log('[useInstantSoulNetData] COORDINATED CACHE CHECK:', { cacheKey, found: !!cached });
    return cached;
  }, [cacheKey]);

  const [graphData, setGraphData] = useState<{ nodes: NodeData[], links: LinkData[] }>(() => {
    if (instantCached) {
      console.log('[useInstantSoulNetData] COORDINATED INSTANT: Using cached data immediately');
      return { nodes: instantCached.data.nodes, links: instantCached.data.links };
    }
    return { nodes: [], links: [] };
  });

  const [translations, setTranslations] = useState<Map<string, string>>(() => {
    return instantCached ? instantCached.data.translations : new Map();
  });

  const [connectionPercentages, setConnectionPercentages] = useState<Map<string, number>>(() => {
    return instantCached ? instantCached.data.connectionPercentages : new Map();
  });

  const [nodeConnectionData, setNodeConnectionData] = useState<Map<string, NodeConnectionData>>(() => {
    return instantCached ? instantCached.data.nodeConnectionData : new Map();
  });

  const [loading, setLoading] = useState(!instantCached);
  const [error, setError] = useState<Error | null>(null);
  const [isInstantReady, setIsInstantReady] = useState(!!instantCached);

  // COORDINATED STATE LISTENER: React to translation state changes
  useEffect(() => {
    const unsubscribe = translationStateManager.addListener({
      onStateChange: (state) => {
        console.log('[useInstantSoulNetData] COORDINATED STATE: Translation state change:', state);
        if (state.loading) {
          setLoading(true);
          setError(null);
        }
      },
      onError: (error) => {
        console.error('[useInstantSoulNetData] COORDINATED STATE: Translation error:', error);
        setError(error);
        setLoading(false);
      },
      onComplete: (language) => {
        console.log('[useInstantSoulNetData] COORDINATED STATE: Translation complete for:', language);
        // Trigger data reload after language change
        if (language === currentLanguage && userId) {
          preloadData();
        }
      }
    });

    return unsubscribe;
  }, [currentLanguage, userId]);

  // ENHANCED instant data getter functions with better fallback handling
  const getInstantConnectionPercentage = useCallback((selectedNode: string, targetNode: string): number => {
    if (!selectedNode || selectedNode === targetNode) return 0;
    
    const key = `${selectedNode}-${targetNode}`;
    const percentage = connectionPercentages.get(key);
    
    if (percentage !== undefined) {
      console.log(`[useInstantSoulNetData] COORDINATED INSTANT: Got percentage ${percentage}% for ${key}`);
      return percentage;
    }
    
    console.log(`[useInstantSoulNetData] COORDINATED INSTANT: No percentage found for ${key}, checking reverse`);
    
    // Check reverse direction as fallback
    const reverseKey = `${targetNode}-${selectedNode}`;
    const reversePercentage = connectionPercentages.get(reverseKey);
    if (reversePercentage !== undefined) {
      console.log(`[useInstantSoulNetData] COORDINATED FALLBACK: Found reverse percentage ${reversePercentage}% for ${reverseKey}`);
      return reversePercentage;
    }
    
    return 0;
  }, [connectionPercentages]);

  const getInstantTranslation = useCallback((nodeId: string): string => {
    if (currentLanguage === 'en') return nodeId;
    
    const translation = translations.get(nodeId);
    if (translation) {
      console.log(`[useInstantSoulNetData] COORDINATED INSTANT: Got translation for ${nodeId}: ${translation}`);
      return translation;
    }
    
    console.log(`[useInstantSoulNetData] COORDINATED INSTANT: No translation for ${nodeId}, using original`);
    return nodeId;
  }, [currentLanguage, translations]);

  const getInstantNodeConnections = useCallback((nodeId: string): NodeConnectionData => {
    const connections = nodeConnectionData.get(nodeId);
    if (connections) {
      console.log(`[useInstantSoulNetData] COORDINATED INSTANT: Found connections for ${nodeId}:`, connections);
      return connections;
    }
    
    console.log(`[useInstantSoulNetData] COORDINATED INSTANT: No connections found for ${nodeId}, returning empty`);
    return {
      connectedNodes: [],
      totalStrength: 0,
      averageStrength: 0
    };
  }, [nodeConnectionData]);

  // ENHANCED background preloading with better error handling
  const preloadData = useCallback(async () => {
    if (!userId || isInstantReady) {
      console.log('[useInstantSoulNetData] COORDINATED: Skipping preload - no userId or already ready');
      return;
    }

    // Check if translation system is locked
    if (translationStateManager.isTranslationLocked()) {
      console.log('[useInstantSoulNetData] COORDINATED: Translation system locked, waiting...');
      // Set a timeout to retry after lock is released
      setTimeout(() => preloadData(), 1000);
      return;
    }

    console.log('[useInstantSoulNetData] COORDINATED: Starting background preload for', userId, timeRange, currentLanguage);
    
    try {
      setError(null);
      
      const result = await EnhancedSoulNetPreloadService.preloadInstantData(
        userId,
        timeRange,
        currentLanguage
      );

      if (result) {
        console.log('[useInstantSoulNetData] COORDINATED: Background preload successful');
        setGraphData({ nodes: result.nodes, links: result.links });
        setTranslations(result.translations);
        setConnectionPercentages(result.connectionPercentages);
        setNodeConnectionData(result.nodeConnectionData);
        setIsInstantReady(true);
      } else {
        console.log('[useInstantSoulNetData] COORDINATED: No data returned from background preload');
        setGraphData({ nodes: [], links: [] });
        setTranslations(new Map());
        setConnectionPercentages(new Map());
        setNodeConnectionData(new Map());
      }
    } catch (err) {
      console.error('[useInstantSoulNetData] COORDINATED: Background preload error:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      
      // Attempt recovery through translation state manager
      if (err instanceof Error && err.message.includes('translation')) {
        try {
          await translationStateManager.recoverFromTranslationFailure(currentLanguage, userId);
        } catch (recoveryError) {
          console.error('[useInstantSoulNetData] COORDINATED: Recovery failed:', recoveryError);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [userId, timeRange, currentLanguage, isInstantReady]);

  // Background preload effect with translation lock awareness
  useEffect(() => {
    if (!isInstantReady) {
      preloadData();
    } else {
      setLoading(false);
    }
  }, [preloadData, isInstantReady]);

  // ENHANCED cache invalidation on language change
  useEffect(() => {
    if (userId) {
      console.log('[useInstantSoulNetData] COORDINATED: Language changed to', currentLanguage, 'clearing cache for', userId);
      EnhancedSoulNetPreloadService.clearInstantCache(userId);
      
      // Reset state
      setIsInstantReady(false);
      setGraphData({ nodes: [], links: [] });
      setTranslations(new Map());
      setConnectionPercentages(new Map());
      setNodeConnectionData(new Map());
    }
  }, [currentLanguage, userId]);

  console.log(`[useInstantSoulNetData] COORDINATED STATE: nodes=${graphData.nodes.length}, translations=${translations.size}, percentages=${connectionPercentages.size}, instantReady=${isInstantReady}, loading=${loading}, coordinator=${translationStateManager.getState().coordinatorId}`);

  return {
    graphData,
    translations,
    connectionPercentages,
    nodeConnectionData,
    loading,
    error,
    isInstantReady,
    getInstantConnectionPercentage,
    getInstantTranslation,
    getInstantNodeConnections
  };
};
