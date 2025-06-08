
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
    if (instantCached) {
      console.log('[useInstantSoulNetData] APP-LEVEL: Using cached data immediately');
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
    
    // APP-LEVEL: First check the coordinated translation cache
    const coordinatedTranslation = translations.get(nodeId);
    if (coordinatedTranslation) {
      console.log(`[useInstantSoulNetData] APP-LEVEL: Got coordinated translation for ${nodeId}: ${coordinatedTranslation}`);
      return coordinatedTranslation;
    }
    
    // APP-LEVEL: Fallback to app-level translation cache
    const appLevelTranslation = getCachedTranslation(nodeId);
    if (appLevelTranslation) {
      console.log(`[useInstantSoulNetData] APP-LEVEL: Got app-level cached translation for ${nodeId}: ${appLevelTranslation}`);
      return appLevelTranslation;
    }
    
    console.log(`[useInstantSoulNetData] APP-LEVEL: No translation found for ${nodeId}, using original`);
    return nodeId;
  }, [currentLanguage, translations, getCachedTranslation]);

  const getInstantNodeConnections = useCallback((nodeId: string): NodeConnectionData => {
    return nodeConnectionData.get(nodeId) || {
      connectedNodes: [],
      totalStrength: 0,
      averageStrength: 0
    };
  }, [nodeConnectionData]);

  // Background preloading using app-level translation service
  const preloadData = useCallback(async () => {
    if (!userId || isInstantReady) {
      console.log('[useInstantSoulNetData] APP-LEVEL: Skipping preload - no userId or already ready');
      return;
    }

    console.log('[useInstantSoulNetData] APP-LEVEL: Starting background preload for', userId, timeRange, currentLanguage);
    
    try {
      setError(null);
      
      const result = await EnhancedSoulNetPreloadService.preloadInstantData(
        userId,
        timeRange,
        currentLanguage
      );

      if (result) {
        console.log('[useInstantSoulNetData] APP-LEVEL: Background preload successful');
        setGraphData({ nodes: result.nodes, links: result.links });
        setTranslations(result.translations);
        setConnectionPercentages(result.connectionPercentages);
        setNodeConnectionData(result.nodeConnectionData);
        setIsInstantReady(true);
      } else {
        console.log('[useInstantSoulNetData] APP-LEVEL: No data returned from background preload');
        setGraphData({ nodes: [], links: [] });
        setTranslations(new Map());
        setConnectionPercentages(new Map());
        setNodeConnectionData(new Map());
      }
    } catch (err) {
      console.error('[useInstantSoulNetData] APP-LEVEL: Background preload error:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
    } finally {
      setLoading(false);
    }
  }, [userId, timeRange, currentLanguage, isInstantReady]);

  // Background preload effect
  useEffect(() => {
    if (!isInstantReady) {
      preloadData();
    } else {
      setLoading(false);
    }
  }, [preloadData, isInstantReady]);

  // Clear cache when language changes
  useEffect(() => {
    if (userId) {
      EnhancedSoulNetPreloadService.clearInstantCache(userId);
    }
  }, [currentLanguage, userId]);

  console.log(`[useInstantSoulNetData] APP-LEVEL STATE: nodes=${graphData.nodes.length}, translations=${translations.size}, percentages=${connectionPercentages.size}, instantReady=${isInstantReady}, loading=${loading}`);

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
