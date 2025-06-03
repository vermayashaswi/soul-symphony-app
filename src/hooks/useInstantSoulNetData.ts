
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

interface InstantSoulNetData {
  graphData: { nodes: NodeData[], links: LinkData[] };
  translations: Map<string, string>;
  connectionPercentages: Map<string, number>;
  nodeConnectionData: Map<string, {
    connectedNodes: string[];
    totalStrength: number;
    averageStrength: number;
  }>;
  loading: boolean;
  error: Error | null;
  isInstantReady: boolean;
}

export const useInstantSoulNetData = (
  userId: string | undefined,
  timeRange: string
): InstantSoulNetData => {
  const { currentLanguage } = useTranslation();
  
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
      console.log('[useInstantSoulNetData] INSTANT: Using cached data immediately');
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

  const [nodeConnectionData, setNodeConnectionData] = useState<Map<string, any>>(() => {
    return instantCached ? instantCached.data.nodeConnectionData : new Map();
  });

  const [loading, setLoading] = useState(!instantCached);
  const [error, setError] = useState<Error | null>(null);
  const [isInstantReady, setIsInstantReady] = useState(!!instantCached);

  // Instant data getter functions
  const getInstantConnectionPercentage = useCallback((selectedNode: string, targetNode: string): number => {
    if (!selectedNode || selectedNode === targetNode) return 0;
    
    const key = `${selectedNode}-${targetNode}`;
    const percentage = connectionPercentages.get(key);
    
    if (percentage !== undefined) {
      console.log(`[useInstantSoulNetData] INSTANT: Got percentage ${percentage}% for ${key}`);
      return percentage;
    }
    
    console.log(`[useInstantSoulNetData] INSTANT: No percentage found for ${key}`);
    return 0;
  }, [connectionPercentages]);

  const getInstantTranslation = useCallback((nodeId: string): string => {
    if (currentLanguage === 'en') return nodeId;
    
    const translation = translations.get(nodeId);
    if (translation) {
      console.log(`[useInstantSoulNetData] INSTANT: Got translation for ${nodeId}: ${translation}`);
      return translation;
    }
    
    console.log(`[useInstantSoulNetData] INSTANT: No translation for ${nodeId}, using original`);
    return nodeId;
  }, [currentLanguage, translations]);

  const getInstantNodeConnections = useCallback((nodeId: string) => {
    return nodeConnectionData.get(nodeId) || {
      connectedNodes: [],
      totalStrength: 0,
      averageStrength: 0
    };
  }, [nodeConnectionData]);

  // Background preloading
  const preloadData = useCallback(async () => {
    if (!userId || isInstantReady) {
      console.log('[useInstantSoulNetData] Skipping preload - no userId or already ready');
      return;
    }

    console.log('[useInstantSoulNetData] Starting background preload for', userId, timeRange, currentLanguage);
    
    try {
      setError(null);
      
      const result = await EnhancedSoulNetPreloadService.preloadInstantData(
        userId,
        timeRange,
        currentLanguage
      );

      if (result) {
        console.log('[useInstantSoulNetData] Background preload successful');
        setGraphData({ nodes: result.nodes, links: result.links });
        setTranslations(result.translations);
        setConnectionPercentages(result.connectionPercentages);
        setNodeConnectionData(result.nodeConnectionData);
        setIsInstantReady(true);
      } else {
        console.log('[useInstantSoulNetData] No data returned from background preload');
        setGraphData({ nodes: [], links: [] });
        setTranslations(new Map());
        setConnectionPercentages(new Map());
        setNodeConnectionData(new Map());
      }
    } catch (err) {
      console.error('[useInstantSoulNetData] Background preload error:', err);
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

  console.log(`[useInstantSoulNetData] STATE: nodes=${graphData.nodes.length}, translations=${translations.size}, percentages=${connectionPercentages.size}, instantReady=${isInstantReady}, loading=${loading}`);

  return {
    graphData,
    translations,
    connectionPercentages,
    nodeConnectionData,
    loading,
    error,
    isInstantReady,
    // Add instant access methods
    getInstantConnectionPercentage,
    getInstantTranslation,
    getInstantNodeConnections
  } as InstantSoulNetData & {
    getInstantConnectionPercentage: (selectedNode: string, targetNode: string) => number;
    getInstantTranslation: (nodeId: string) => string;
    getInstantNodeConnections: (nodeId: string) => any;
  };
};
