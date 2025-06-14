import { useState, useEffect, useCallback, useRef } from 'react';
import { AtomicSoulNetService } from '@/services/atomicSoulNetService';
import { SimplifiedSoulNetTranslationService } from '@/services/simplifiedSoulNetTranslationService';
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

interface UseAtomicSoulNetDataReturn {
  graphData: { nodes: NodeData[], links: LinkData[] };
  translations: Map<string, string>;
  connectionPercentages: Map<string, number>;
  nodeConnectionData: Map<string, NodeConnectionData>;
  loading: boolean;
  error: Error | null;
  isTranslating: boolean;
  translationProgress: number;
  translationComplete: boolean;
  canRender: boolean; // NEW: Determines if visualization should render
  getNodeTranslation: (nodeId: string) => string;
  getConnectionPercentage: (selectedNode: string, targetNode: string) => number;
  getNodeConnections: (nodeId: string) => NodeConnectionData;
  setNodeTranslations: (translations: Map<string, string>) => void;
}

export const useAtomicSoulNetData = (
  userId: string | undefined,
  timeRange: string
): UseAtomicSoulNetDataReturn => {
  const { currentLanguage } = useTranslation();
  
  const [graphData, setGraphData] = useState<{ nodes: NodeData[], links: LinkData[] }>({ nodes: [], links: [] });
  const [translations, setTranslations] = useState<Map<string, string>>(new Map());
  const [connectionPercentages, setConnectionPercentages] = useState<Map<string, number>>(new Map());
  const [nodeConnectionData, setNodeConnectionData] = useState<Map<string, NodeConnectionData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(100);
  const [translationComplete, setTranslationComplete] = useState(false);
  const [canRender, setCanRender] = useState(false);

  // List of node IDs always for the current graph data (never cleared on timeRange change)
  const nodeIdsRef = useRef<string[]>([]);
  // Translation cache per language in memory (resets only if language changes, not time range)
  const translationCache = useRef<Map<string, string>>(new Map());

  // OPTIMIZED: Single data loading function with strict completion requirements
  const loadAllData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setCanRender(false);
      return;
    }

    console.log(`[useAtomicSoulNetData] RELAXED LOADING: Loading all data for ${userId}, ${timeRange}, ${currentLanguage}`);
    
    try {
      setError(null);
      setLoading(true);
      setCanRender(false);

      // Graph data is time-range specific
      const result = await AtomicSoulNetService.getAtomicData(userId, timeRange, 'en');
      
      if (!result) {
        setGraphData({ nodes: [], links: [] });
        setConnectionPercentages(new Map());
        setNodeConnectionData(new Map());
        nodeIdsRef.current = [];
        setCanRender(false);
        setLoading(false);
        return;
      }

      setGraphData({ nodes: result.nodes, links: result.links });
      setConnectionPercentages(result.connectionPercentages);
      setNodeConnectionData(result.nodeConnectionData);

      const nodeIds = result.nodes.map(node => node.id);
      nodeIdsRef.current = nodeIds;

      // Do not clear translationCache on timeRange change
      setLoading(false);
      setCanRender(true);

    } catch (err) {
      console.error('[useAtomicSoulNetData] RELAXED LOADING: Error loading data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      setCanRender(false);
      setLoading(false);
    }
  }, [userId, timeRange, currentLanguage]);

  // Only reload graphData on timeRange change
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Update canRender state as soon as graph loaded
  useEffect(() => {
    if (graphData.nodes.length !== 0) {
      setCanRender(true);
    }
  }, [graphData.nodes.length]);

  // Translation lookup delegates to persistent cache now
  const getNodeTranslation = useCallback((nodeId: string): string => {
    // Use persistent cache (not keyed on timeRange) and always return original if missing
    return translationCache.current.get(nodeId) || nodeId;
  }, []);

  // Utility to set the node translation cache from SoulNet for coordination
  const setNodeTranslations = useCallback((translations: Map<string, string>) => {
    translationCache.current = new Map(translations);
  }, []);

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

  console.log(`[useAtomicSoulNetData] RELAXED STATE: nodes=${graphData.nodes.length}, translations=${translations.size}, loading=${loading}, translating=${isTranslating}, progress=${translationProgress}%, complete=${translationComplete}, canRender=${canRender} (requires 100% for ${currentLanguage})`);

  return {
    graphData,
    translations: translationCache.current,
    connectionPercentages,
    nodeConnectionData,
    loading,
    error,
    isTranslating,
    translationProgress,
    translationComplete,
    canRender,
    getNodeTranslation,
    getConnectionPercentage,
    getNodeConnections,
    setNodeTranslations
  };
};
