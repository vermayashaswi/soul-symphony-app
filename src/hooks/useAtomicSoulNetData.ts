
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

export interface UseAtomicSoulNetDataResult {
  graphData: { nodes: NodeData[]; links: LinkData[] };
  translations: Map<string, string>;
  connectionPercentages: Map<string, number>;
  nodeConnectionData: Map<string, NodeConnectionData>;
  loading: boolean;
  error: Error | null;
  isTranslating: boolean;
  translationProgress: number;
  translationComplete: boolean;
  canRender: boolean;
  getNodeTranslation: (nodeId: string) => string;
  getConnectionPercentage: (sourceId: string, targetId: string) => number;
  getNodeConnections: (nodeId: string) => NodeConnectionData | null;
}

export const useAtomicSoulNetData = (
  userId: string | undefined,
  timeRange: string
): UseAtomicSoulNetDataResult => {
  const { currentLanguage, prefetchAllSoulNetTimeRanges } = useTranslation();
  const [graphData, setGraphData] = useState<{ nodes: NodeData[]; links: LinkData[] }>({ nodes: [], links: [] });
  const [translations, setTranslations] = useState<Map<string, string>>(new Map());
  const [connectionPercentages, setConnectionPercentages] = useState<Map<string, number>>(new Map());
  const [nodeConnectionData, setNodeConnectionData] = useState<Map<string, NodeConnectionData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(100);
  const [translationComplete, setTranslationComplete] = useState(true);
  const [hasPreloadedAllTimeRanges, setHasPreloadedAllTimeRanges] = useState(false);

  console.log(`[useAtomicSoulNetData] ENHANCED: Hook called for ${userId}, ${timeRange}, ${currentLanguage}`);

  // ENHANCED: Preload all time ranges when language changes to prevent cache misses
  useEffect(() => {
    if (!userId || !prefetchAllSoulNetTimeRanges || currentLanguage === 'en') {
      setHasPreloadedAllTimeRanges(true);
      return;
    }

    if (!hasPreloadedAllTimeRanges) {
      console.log(`[useAtomicSoulNetData] ENHANCED: Preloading all time ranges for language ${currentLanguage}`);
      
      prefetchAllSoulNetTimeRanges(userId)
        .then(() => {
          console.log('[useAtomicSoulNetData] ENHANCED: All time ranges preloaded successfully');
          setHasPreloadedAllTimeRanges(true);
        })
        .catch(error => {
          console.error('[useAtomicSoulNetData] ENHANCED: Error preloading time ranges:', error);
          setHasPreloadedAllTimeRanges(true); // Continue even if preload fails
        });
    }
  }, [userId, currentLanguage, prefetchAllSoulNetTimeRanges, hasPreloadedAllTimeRanges]);

  // Reset preload state when language changes
  useEffect(() => {
    setHasPreloadedAllTimeRanges(false);
  }, [currentLanguage]);

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    console.log(`[useAtomicSoulNetData] ENHANCED: Loading data for ${userId}, ${timeRange}, ${currentLanguage}`);

    try {
      setLoading(true);
      setError(null);

      const result = await AtomicSoulNetService.getAtomicData(userId, timeRange, currentLanguage);
      
      if (result) {
        console.log(`[useAtomicSoulNetData] ENHANCED: Data loaded - nodes: ${result.nodes.length}, translations: ${result.translations.size}, progress: ${result.translationProgress}%`);
        
        setGraphData({ nodes: result.nodes, links: result.links });
        setTranslations(result.translations);
        setConnectionPercentages(result.connectionPercentages);
        setNodeConnectionData(result.nodeConnectionData);
        setIsTranslating(result.isTranslating);
        setTranslationProgress(result.translationProgress);
        setTranslationComplete(result.translationComplete);
      } else {
        console.log('[useAtomicSoulNetData] ENHANCED: No data returned');
        setGraphData({ nodes: [], links: [] });
        setTranslations(new Map());
        setConnectionPercentages(new Map());
        setNodeConnectionData(new Map());
        setIsTranslating(false);
        setTranslationProgress(100);
        setTranslationComplete(true);
      }
    } catch (err) {
      console.error('[useAtomicSoulNetData] ENHANCED: Error loading data:', err);
      setError(err instanceof Error ? err : new Error('Failed to load SoulNet data'));
    } finally {
      setLoading(false);
    }
  }, [userId, timeRange, currentLanguage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for translation completion events
  useEffect(() => {
    const handleTranslationComplete = (event: CustomEvent) => {
      if (event.detail.language === currentLanguage) {
        console.log('[useAtomicSoulNetData] ENHANCED: Translation completion event received, reloading data');
        loadData();
      }
    };

    window.addEventListener('atomicSoulNetTranslationComplete', handleTranslationComplete as EventListener);
    
    return () => {
      window.removeEventListener('atomicSoulNetTranslationComplete', handleTranslationComplete as EventListener);
    };
  }, [currentLanguage, loadData]);

  // ENHANCED: Better render control - can render with 70%+ translation coverage
  const canRender = !loading && graphData.nodes.length > 0 && (!isTranslating || translationProgress >= 70);

  const getNodeTranslation = useCallback((nodeId: string): string => {
    const translation = translations.get(nodeId);
    return translation || nodeId;
  }, [translations]);

  const getConnectionPercentage = useCallback((sourceId: string, targetId: string): number => {
    const percentage = connectionPercentages.get(`${sourceId}-${targetId}`);
    return percentage || 0;
  }, [connectionPercentages]);

  const getNodeConnections = useCallback((nodeId: string): NodeConnectionData | null => {
    return nodeConnectionData.get(nodeId) || null;
  }, [nodeConnectionData]);

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
    canRender,
    getNodeTranslation,
    getConnectionPercentage,
    getNodeConnections
  };
};
