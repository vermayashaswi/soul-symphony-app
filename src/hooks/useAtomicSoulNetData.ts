
import { useState, useEffect, useCallback } from 'react';
import { AtomicSoulNetService } from '@/services/atomicSoulNetService';
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

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    console.log(`[useAtomicSoulNetData] ATOMIC: Loading data for ${userId}, ${timeRange}, ${currentLanguage}`);
    
    try {
      setError(null);
      setLoading(true);

      const result = await AtomicSoulNetService.getAtomicData(
        userId,
        timeRange,
        currentLanguage
      );

      if (result) {
        console.log(`[useAtomicSoulNetData] ATOMIC: Data loaded successfully`, {
          nodes: result.nodes.length,
          translations: result.translations.size,
          isTranslating: result.isTranslating,
          translationComplete: result.translationComplete,
          progress: result.translationProgress
        });
        
        setGraphData({ nodes: result.nodes, links: result.links });
        setTranslations(result.translations);
        setConnectionPercentages(result.connectionPercentages);
        setNodeConnectionData(result.nodeConnectionData);
        setIsTranslating(result.isTranslating);
        setTranslationProgress(result.translationProgress);
        setTranslationComplete(result.translationComplete);
      } else {
        console.log('[useAtomicSoulNetData] ATOMIC: No data returned');
        setGraphData({ nodes: [], links: [] });
        setTranslations(new Map());
        setConnectionPercentages(new Map());
        setNodeConnectionData(new Map());
        setIsTranslating(false);
        setTranslationProgress(100);
        setTranslationComplete(true);
      }
    } catch (err) {
      console.error('[useAtomicSoulNetData] ATOMIC: Error loading data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      setIsTranslating(false);
      setTranslationProgress(100);
      setTranslationComplete(false);
    } finally {
      setLoading(false);
    }
  }, [userId, timeRange, currentLanguage]);

  // Load data when dependencies change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for atomic translation completion
  useEffect(() => {
    const handleTranslationComplete = (event: CustomEvent) => {
      const stateKey = `${userId}-${currentLanguage}`;
      if (event.detail.stateKey === stateKey) {
        console.log('[useAtomicSoulNetData] ATOMIC: Translation completed, reloading data');
        loadData();
      }
    };

    window.addEventListener('atomicSoulNetTranslationComplete', handleTranslationComplete as EventListener);
    
    return () => {
      window.removeEventListener('atomicSoulNetTranslationComplete', handleTranslationComplete as EventListener);
    };
  }, [userId, currentLanguage, loadData]);

  // Get node translation (guaranteed atomic consistency)
  const getNodeTranslation = useCallback((nodeId: string): string => {
    if (currentLanguage === 'en') {
      return nodeId;
    }

    // Only use translations if atomic translation is complete
    if (translationComplete) {
      const translation = translations.get(nodeId);
      if (translation) {
        return translation;
      }
    }

    // Return original text to maintain atomic consistency
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

  console.log(`[useAtomicSoulNetData] ATOMIC STATE: nodes=${graphData.nodes.length}, translations=${translations.size}, loading=${loading}, translating=${isTranslating}, progress=${translationProgress}%, complete=${translationComplete}`);

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
