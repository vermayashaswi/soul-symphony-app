
import { useState, useEffect, useCallback } from 'react';
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
  getNodeTranslation: (nodeId: string) => string;
  getConnectionPercentage: (selectedNode: string, targetNode: string) => number;
  getNodeConnections: (nodeId: string) => NodeConnectionData;
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

  // SIMPLIFIED: Load graph data (language-independent)
  const loadGraphData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return null;
    }

    console.log(`[useAtomicSoulNetData] SIMPLIFIED: Loading graph data for ${userId}, ${timeRange}`);
    
    try {
      const result = await AtomicSoulNetService.getAtomicData(userId, timeRange, 'en');
      
      if (result) {
        console.log(`[useAtomicSoulNetData] SIMPLIFIED: Graph data loaded`, {
          nodes: result.nodes.length,
          links: result.links.length
        });
        
        setGraphData({ nodes: result.nodes, links: result.links });
        setConnectionPercentages(result.connectionPercentages);
        setNodeConnectionData(result.nodeConnectionData);
        return result.nodes.map(node => node.id);
      } else {
        console.log('[useAtomicSoulNetData] SIMPLIFIED: No graph data');
        setGraphData({ nodes: [], links: [] });
        setConnectionPercentages(new Map());
        setNodeConnectionData(new Map());
        return [];
      }
    } catch (err) {
      console.error('[useAtomicSoulNetData] SIMPLIFIED: Error loading graph data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      return null;
    }
  }, [userId, timeRange]);

  // SIMPLIFIED: Load translations (language-dependent)
  const loadTranslations = useCallback(async (nodeIds: string[]) => {
    if (!userId || !nodeIds || nodeIds.length === 0) {
      setTranslations(new Map());
      setIsTranslating(false);
      setTranslationProgress(100);
      setTranslationComplete(true);
      return;
    }

    console.log(`[useAtomicSoulNetData] SIMPLIFIED: Loading translations for ${nodeIds.length} nodes in ${currentLanguage}`);
    
    try {
      const result = await SimplifiedSoulNetTranslationService.getTranslationsForLanguage(
        nodeIds,
        currentLanguage,
        userId
      );

      console.log(`[useAtomicSoulNetData] SIMPLIFIED: Translation result`, {
        translations: result.translations.size,
        isTranslating: result.isTranslating,
        complete: result.translationComplete,
        progress: result.progress
      });
      
      setTranslations(result.translations);
      setIsTranslating(result.isTranslating);
      setTranslationProgress(result.progress);
      setTranslationComplete(result.translationComplete);
    } catch (err) {
      console.error('[useAtomicSoulNetData] SIMPLIFIED: Error loading translations:', err);
      setTranslations(new Map());
      setIsTranslating(false);
      setTranslationProgress(100);
      setTranslationComplete(false);
    }
  }, [userId, currentLanguage]);

  // SIMPLIFIED: Load data when dependencies change
  useEffect(() => {
    const loadData = async () => {
      setError(null);
      setLoading(true);

      const nodeIds = await loadGraphData();
      if (nodeIds) {
        await loadTranslations(nodeIds);
      }
      
      setLoading(false);
    };

    loadData();
  }, [loadGraphData, loadTranslations]);

  // SIMPLIFIED: Listen for translation completion
  useEffect(() => {
    const handleTranslationComplete = (event: CustomEvent) => {
      const stateKey = `${userId}-${currentLanguage}`;
      if (event.detail.stateKey === stateKey) {
        console.log('[useAtomicSoulNetData] SIMPLIFIED: Translation completed, reloading translations');
        const nodeIds = graphData.nodes.map(node => node.id);
        if (nodeIds.length > 0) {
          loadTranslations(nodeIds);
        }
      }
    };

    window.addEventListener('soulNetTranslationComplete', handleTranslationComplete as EventListener);
    
    return () => {
      window.removeEventListener('soulNetTranslationComplete', handleTranslationComplete as EventListener);
    };
  }, [userId, currentLanguage, graphData.nodes, loadTranslations]);

  // SIMPLIFIED: Get node translation with fallback
  const getNodeTranslation = useCallback((nodeId: string): string => {
    if (currentLanguage === 'en') {
      return nodeId;
    }

    // Use translations only when complete to maintain consistency
    if (translationComplete) {
      const translation = translations.get(nodeId);
      if (translation) {
        return translation;
      }
    }

    // Return original text for consistency
    return nodeId;
  }, [currentLanguage, translations, translationComplete]);

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

  console.log(`[useAtomicSoulNetData] SIMPLIFIED STATE: nodes=${graphData.nodes.length}, translations=${translations.size}, loading=${loading}, translating=${isTranslating}, progress=${translationProgress}%, complete=${translationComplete}`);

  return {
    graphData,
    translations,
    connectionPercentages,
    nodeConnectionData,
    loading,
    error,
    isTranslating,
    translationProgress,
    translationComplete,
    getNodeTranslation,
    getConnectionPercentage,
    getNodeConnections
  };
};
