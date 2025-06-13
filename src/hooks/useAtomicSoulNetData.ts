
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
  canRender: boolean; // NEW: Determines if visualization should render
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
  const [canRender, setCanRender] = useState(false);

  // STRICT RENDERING: Require 100% translation coverage for non-English languages
  const canRenderVisualization = useCallback((
    nodeIds: string[], 
    currentTranslations: Map<string, string>, 
    language: string
  ): boolean => {
    if (nodeIds.length === 0) return false;
    
    // For English, we can always render immediately
    if (language === 'en') return true;
    
    // For other languages, require 100% translation coverage to prevent English labels
    const translationCoverage = currentTranslations.size / nodeIds.length;
    const canRender = translationCoverage >= 1.0; // Changed from 0.7 to 1.0 (100%)
    
    console.log(`[useAtomicSoulNetData] STRICT RENDERING: Coverage ${Math.round(translationCoverage * 100)}%, can render: ${canRender} (requires 100% for ${language})`);
    return canRender;
  }, []);

  // CACHE-FIRST: Pre-load cached translations immediately
  const preloadCachedTranslations = useCallback(async (nodeIds: string[]) => {
    if (!nodeIds || nodeIds.length === 0) {
      setTranslations(new Map());
      return new Map<string, string>();
    }

    console.log(`[useAtomicSoulNetData] CACHE-FIRST: Pre-loading cached translations for ${nodeIds.length} nodes in ${currentLanguage}`);
    
    try {
      // For English, create immediate translations
      if (currentLanguage === 'en') {
        const englishTranslations = new Map<string, string>();
        nodeIds.forEach(nodeId => englishTranslations.set(nodeId, nodeId));
        setTranslations(englishTranslations);
        return englishTranslations;
      }

      // For other languages, get all available cached translations and ensure completion
      const result = await SimplifiedSoulNetTranslationService.getTranslationsForLanguage(
        nodeIds,
        currentLanguage,
        userId!
      );

      console.log(`[useAtomicSoulNetData] CACHE-FIRST: Loaded ${result.translations.size}/${nodeIds.length} cached translations`);
      setTranslations(result.translations);
      setIsTranslating(result.isTranslating);
      setTranslationProgress(result.progress);
      setTranslationComplete(result.translationComplete);

      // For non-English languages, ensure we have complete translations before allowing render
      if (result.translations.size === nodeIds.length) {
        console.log(`[useAtomicSoulNetData] CACHE-COMPLETE: All ${nodeIds.length} translations cached for ${currentLanguage}`);
      } else {
        console.log(`[useAtomicSoulNetData] CACHE-INCOMPLETE: ${result.translations.size}/${nodeIds.length} translations cached, rendering blocked until complete`);
      }

      return result.translations;
    } catch (err) {
      console.error('[useAtomicSoulNetData] CACHE-FIRST: Error loading cached translations:', err);
      const fallbackTranslations = new Map<string, string>();
      nodeIds.forEach(nodeId => fallbackTranslations.set(nodeId, nodeId));
      setTranslations(fallbackTranslations);
      return fallbackTranslations;
    }
  }, [userId, currentLanguage]);

  // OPTIMIZED: Single data loading function with strict completion requirements
  const loadAllData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setCanRender(false);
      return;
    }

    console.log(`[useAtomicSoulNetData] STRICT LOADING: Loading all data for ${userId}, ${timeRange}, ${currentLanguage}`);
    
    try {
      setError(null);
      setLoading(true);
      setCanRender(false);

      // Step 1: Load graph data (language-independent)
      const result = await AtomicSoulNetService.getAtomicData(userId, timeRange, 'en');
      
      if (!result) {
        console.log('[useAtomicSoulNetData] STRICT LOADING: No graph data available');
        setGraphData({ nodes: [], links: [] });
        setConnectionPercentages(new Map());
        setNodeConnectionData(new Map());
        setTranslations(new Map());
        setCanRender(false);
        setLoading(false);
        return;
      }

      // Set graph data immediately
      setGraphData({ nodes: result.nodes, links: result.links });
      setConnectionPercentages(result.connectionPercentages);
      setNodeConnectionData(result.nodeConnectionData);

      const nodeIds = result.nodes.map(node => node.id);
      console.log(`[useAtomicSoulNetData] STRICT LOADING: Graph loaded with ${nodeIds.length} nodes`);

      // Step 2: Load translations with strict completion requirements
      const loadedTranslations = await preloadCachedTranslations(nodeIds);

      // Step 3: Apply strict rendering criteria (100% coverage for non-English)
      const shouldRender = canRenderVisualization(nodeIds, loadedTranslations, currentLanguage);
      setCanRender(shouldRender);

      console.log(`[useAtomicSoulNetData] STRICT LOADING: Can render: ${shouldRender}, translations: ${loadedTranslations.size}/${nodeIds.length} (${currentLanguage} requires 100%)`);
      
      setLoading(false);
    } catch (err) {
      console.error('[useAtomicSoulNetData] STRICT LOADING: Error loading data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      setCanRender(false);
      setLoading(false);
    }
  }, [userId, timeRange, currentLanguage, preloadCachedTranslations, canRenderVisualization]);

  // Load data when dependencies change
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Listen for translation completion and update render status with strict requirements
  useEffect(() => {
    const handleTranslationComplete = async (event: CustomEvent) => {
      const stateKey = `${userId}-${currentLanguage}`;
      if (event.detail.stateKey === stateKey) {
        console.log('[useAtomicSoulNetData] STRICT COMPLETION: Translation completed, updating translations and render status');
        
        const nodeIds = graphData.nodes.map(node => node.id);
        if (nodeIds.length > 0) {
          const updatedTranslations = await preloadCachedTranslations(nodeIds);
          const shouldRender = canRenderVisualization(nodeIds, updatedTranslations, currentLanguage);
          
          // Only allow rendering if we have 100% coverage for non-English languages
          if (currentLanguage !== 'en' && updatedTranslations.size !== nodeIds.length) {
            console.log(`[useAtomicSoulNetData] STRICT COMPLETION: Blocking render - only ${updatedTranslations.size}/${nodeIds.length} translations available`);
            setCanRender(false);
          } else {
            setCanRender(shouldRender);
            console.log(`[useAtomicSoulNetData] STRICT COMPLETION: Allowing render - complete translations available`);
          }
        }
      }
    };

    window.addEventListener('soulNetTranslationComplete', handleTranslationComplete as EventListener);
    
    return () => {
      window.removeEventListener('soulNetTranslationComplete', handleTranslationComplete as EventListener);
    };
  }, [userId, currentLanguage, graphData.nodes, preloadCachedTranslations, canRenderVisualization]);

  // CACHE-FIRST: Get node translation with immediate cache lookup
  const getNodeTranslation = useCallback((nodeId: string): string => {
    // Always prioritize cached translations for consistency
    const cached = translations.get(nodeId);
    if (cached) {
      return cached;
    }

    // For English or when no translation is available, return original
    return nodeId;
  }, [translations]);

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

  console.log(`[useAtomicSoulNetData] STRICT STATE: nodes=${graphData.nodes.length}, translations=${translations.size}, loading=${loading}, translating=${isTranslating}, progress=${translationProgress}%, complete=${translationComplete}, canRender=${canRender} (requires 100% for ${currentLanguage})`);

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
