
import { useState, useEffect, useCallback } from 'react';
import { NodeBasedSoulNetService } from '@/services/nodeBasedSoulNetService';
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

interface UseNodeBasedSoulNetDataReturn {
  graphData: { nodes: NodeData[], links: LinkData[] };
  translations: Map<string, string>;
  connectionPercentages: Map<string, number>;
  nodeConnectionData: Map<string, NodeConnectionData>;
  loading: boolean;
  error: Error | null;
  isTranslating: boolean;
  translationProgress: number;
  getNodeTranslation: (nodeId: string) => string;
  getConnectionPercentage: (selectedNode: string, targetNode: string) => number;
  getNodeConnections: (nodeId: string) => NodeConnectionData;
}

export const useNodeBasedSoulNetData = (
  userId: string | undefined,
  timeRange: string
): UseNodeBasedSoulNetDataReturn => {
  const { currentLanguage } = useTranslation();
  
  const [graphData, setGraphData] = useState<{ nodes: NodeData[], links: LinkData[] }>({ nodes: [], links: [] });
  const [translations, setTranslations] = useState<Map<string, string>>(new Map());
  const [connectionPercentages, setConnectionPercentages] = useState<Map<string, number>>(new Map());
  const [nodeConnectionData, setNodeConnectionData] = useState<Map<string, NodeConnectionData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(100);

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    console.log(`[useNodeBasedSoulNetData] Loading data for ${userId}, ${timeRange}, ${currentLanguage}`);
    
    try {
      setError(null);
      
      // Check translation state before loading
      const translationState = NodeBasedSoulNetService.getTranslationState(`${userId}-${currentLanguage}`);
      setIsTranslating(translationState.isTranslating);
      setTranslationProgress(translationState.progress);

      const result = await NodeBasedSoulNetService.getNodeBasedData(
        userId,
        timeRange,
        currentLanguage
      );

      if (result) {
        console.log(`[useNodeBasedSoulNetData] Data loaded: ${result.nodes.length} nodes, ${result.translations.size} translations`);
        
        setGraphData({ nodes: result.nodes, links: result.links });
        setTranslations(result.translations);
        setConnectionPercentages(result.connectionPercentages);
        setNodeConnectionData(result.nodeConnectionData);
        setIsTranslating(result.isTranslating);
        setTranslationProgress(result.translationProgress);
      } else {
        console.log('[useNodeBasedSoulNetData] No data returned');
        setGraphData({ nodes: [], links: [] });
        setTranslations(new Map());
        setConnectionPercentages(new Map());
        setNodeConnectionData(new Map());
        setIsTranslating(false);
        setTranslationProgress(100);
      }
    } catch (err) {
      console.error('[useNodeBasedSoulNetData] Error loading data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      setIsTranslating(false);
      setTranslationProgress(100);
    } finally {
      setLoading(false);
    }
  }, [userId, timeRange, currentLanguage]);

  // Load data when dependencies change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // NODE-BASED: Get translation for a specific node (persistent across time ranges)
  const getNodeTranslation = useCallback((nodeId: string): string => {
    if (currentLanguage === 'en') {
      return nodeId;
    }

    // Use persistent node translation
    const translation = translations.get(nodeId);
    if (translation) {
      return translation;
    }

    // If no translation found, return original (this maintains consistency)
    return nodeId;
  }, [currentLanguage, translations]);

  const getConnectionPercentage = useCallback((selectedNode: string, targetNode: string): number => {
    if (!selectedNode || selectedNode === targetNode) return 0;
    
    const key = `${selectedNode}-${targetNode}`;
    return connectionPercentages.get(key) || 0;
  }, [connectionPercentages]);

  const getNodeConnections = useCallback((nodeId: string): NodeConnectionData => {
    return nodeConnectionData.get(nodeId) || {
      connectedNodes: [],
      totalStrength: 0,
      averageStrength: 0
    };
  }, [nodeConnectionData]);

  console.log(`[useNodeBasedSoulNetData] State: nodes=${graphData.nodes.length}, translations=${translations.size}, loading=${loading}, translating=${isTranslating}, progress=${translationProgress}%`);

  return {
    graphData,
    translations,
    connectionPercentages,
    nodeConnectionData,
    loading,
    error,
    isTranslating,
    translationProgress,
    getNodeTranslation,
    getConnectionPercentage,
    getNodeConnections
  };
};
