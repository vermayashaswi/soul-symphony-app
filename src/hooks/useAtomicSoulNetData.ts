
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
  canRender: boolean;
  isCacheReady: boolean;
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
  const [isCacheReady, setIsCacheReady] = useState(false);

  // NEW: Pre-translation cache for comprehensive coverage
  const [preTranslationCache, setPreTranslationCache] = useState<Map<string, string>>(new Map());
  const [isPreTranslating, setIsPreTranslating] = useState(false);
  const [preTranslationProgress, setPreTranslationProgress] = useState(0);

  // ENHANCED: Pre-translate all possible nodes for comprehensive coverage
  const preTranslateAllNodes = useCallback(async () => {
    if (!userId || currentLanguage === 'en') {
      setIsPreTranslating(false);
      setPreTranslationProgress(100);
      setPreTranslationCache(new Map());
      return;
    }

    console.log(`[useAtomicSoulNetData] PRE-TRANSLATION: Starting comprehensive pre-translation for ${currentLanguage}`);
    
    try {
      setIsPreTranslating(true);
      setPreTranslationProgress(0);

      // Get all possible nodes from the year timeframe for maximum coverage
      const yearData = await AtomicSoulNetService.getAtomicData(userId, 'year', 'en');
      if (!yearData || yearData.nodes.length === 0) {
        console.log('[useAtomicSoulNetData] PRE-TRANSLATION: No year data available');
        setIsPreTranslating(false);
        setPreTranslationProgress(100);
        return;
      }

      const allNodeIds = [...new Set(yearData.nodes.map(node => node.id))];
      console.log(`[useAtomicSoulNetData] PRE-TRANSLATION: Found ${allNodeIds.length} unique nodes to pre-translate`);

      // Check existing cached translations
      const existingTranslations = await SimplifiedSoulNetTranslationService.getTranslationsForLanguage(
        allNodeIds,
        currentLanguage,
        userId
      );

      const uncachedNodes = allNodeIds.filter(nodeId => !existingTranslations.translations.has(nodeId));
      
      if (uncachedNodes.length === 0) {
        console.log('[useAtomicSoulNetData] PRE-TRANSLATION: All nodes already cached');
        setPreTranslationCache(existingTranslations.translations);
        setIsPreTranslating(false);
        setPreTranslationProgress(100);
        return;
      }

      console.log(`[useAtomicSoulNetData] PRE-TRANSLATION: Need to translate ${uncachedNodes.length} uncached nodes`);

      // Start background translation with progress tracking
      await SimplifiedSoulNetTranslationService.batchTranslateAndCache(
        uncachedNodes,
        currentLanguage,
        userId,
        (progress) => {
          const totalProgress = Math.round(
            ((existingTranslations.translations.size + (uncachedNodes.length * progress / 100)) / allNodeIds.length) * 100
          );
          setPreTranslationProgress(totalProgress);
          console.log(`[useAtomicSoulNetData] PRE-TRANSLATION: Progress ${totalProgress}%`);
        }
      );

      // Get final translations
      const finalTranslations = await SimplifiedSoulNetTranslationService.getTranslationsForLanguage(
        allNodeIds,
        currentLanguage,
        userId
      );

      setPreTranslationCache(finalTranslations.translations);
      setPreTranslationProgress(100);
      console.log(`[useAtomicSoulNetData] PRE-TRANSLATION: Completed with ${finalTranslations.translations.size} translations cached`);
      
    } catch (error) {
      console.error('[useAtomicSoulNetData] PRE-TRANSLATION: Error during pre-translation:', error);
      setPreTranslationProgress(100); // Allow rendering even if pre-translation fails
    } finally {
      setIsPreTranslating(false);
    }
  }, [userId, currentLanguage]);

  // ENHANCED: Fast cache validation using pre-translation cache
  const validateCacheCompleteness = useCallback((
    nodeIds: string[], 
    currentTranslations: Map<string, string>, 
    language: string
  ): { isCacheComplete: boolean, canRender: boolean } => {
    if (nodeIds.length === 0) return { isCacheComplete: false, canRender: false };
    
    // For English, cache is always complete
    if (language === 'en') return { isCacheComplete: true, canRender: true };
    
    // Check if we have translations in pre-translation cache or current translations
    const translationCoverage = nodeIds.filter(nodeId => 
      currentTranslations.has(nodeId) || preTranslationCache.has(nodeId)
    ).length / nodeIds.length;
    
    const isCacheComplete = translationCoverage >= 1.0;
    const canRender = isCacheComplete;
    
    console.log(`[useAtomicSoulNetData] CACHE VALIDATION: Coverage ${Math.round(translationCoverage * 100)}%, complete: ${isCacheComplete}, can render: ${canRender} (${language})`);
    return { isCacheComplete, canRender };
  }, [preTranslationCache]);

  // ENHANCED: Instant cache preload with pre-translation cache support
  const preloadCachedTranslations = useCallback(async (nodeIds: string[]) => {
    if (!nodeIds || nodeIds.length === 0) {
      setTranslations(new Map());
      setIsCacheReady(false);
      return new Map<string, string>();
    }

    console.log(`[useAtomicSoulNetData] CACHE PRELOAD: Loading cached translations for ${nodeIds.length} nodes in ${currentLanguage}`);
    
    try {
      // For English, create immediate translations
      if (currentLanguage === 'en') {
        const englishTranslations = new Map<string, string>();
        nodeIds.forEach(nodeId => englishTranslations.set(nodeId, nodeId));
        setTranslations(englishTranslations);
        setIsCacheReady(true);
        return englishTranslations;
      }

      // For other languages, combine database cache and pre-translation cache
      const result = await SimplifiedSoulNetTranslationService.getTranslationsForLanguage(
        nodeIds,
        currentLanguage,
        userId!
      );

      // Merge with pre-translation cache for complete coverage
      const combinedTranslations = new Map(result.translations);
      nodeIds.forEach(nodeId => {
        if (!combinedTranslations.has(nodeId) && preTranslationCache.has(nodeId)) {
          combinedTranslations.set(nodeId, preTranslationCache.get(nodeId)!);
        }
      });

      console.log(`[useAtomicSoulNetData] CACHE PRELOAD: Loaded ${result.translations.size} from DB, ${combinedTranslations.size - result.translations.size} from pre-cache, total: ${combinedTranslations.size}/${nodeIds.length}`);
      setTranslations(combinedTranslations);

      // Validate cache completeness with combined translations
      const cacheValidation = validateCacheCompleteness(nodeIds, combinedTranslations, currentLanguage);
      setIsCacheReady(cacheValidation.isCacheComplete);

      // Set translation states based on cache completeness
      if (cacheValidation.isCacheComplete) {
        console.log(`[useAtomicSoulNetData] CACHE COMPLETE: All translations available, skipping translation loader`);
        setIsTranslating(false);
        setTranslationProgress(100);
        setTranslationComplete(true);
      } else {
        console.log(`[useAtomicSoulNetData] CACHE INCOMPLETE: ${combinedTranslations.size}/${nodeIds.length} translations available`);
        setIsTranslating(result.isTranslating);
        setTranslationProgress(result.progress);
        setTranslationComplete(result.translationComplete);
      }

      return combinedTranslations;
    } catch (err) {
      console.error('[useAtomicSoulNetData] CACHE PRELOAD: Error loading cached translations:', err);
      const fallbackTranslations = new Map<string, string>();
      nodeIds.forEach(nodeId => fallbackTranslations.set(nodeId, nodeId));
      setTranslations(fallbackTranslations);
      setIsCacheReady(true);
      return fallbackTranslations;
    }
  }, [userId, currentLanguage, preTranslationCache, validateCacheCompleteness]);

  // ENHANCED: Data loading with pre-translation integration
  const loadAllData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setCanRender(false);
      setIsCacheReady(false);
      return;
    }

    console.log(`[useAtomicSoulNetData] ENHANCED LOADING: Loading data for ${userId}, ${timeRange}, ${currentLanguage}`);
    
    try {
      setError(null);
      setLoading(true);
      setCanRender(false);
      setIsCacheReady(false);

      // Step 1: Load graph data (language-independent)
      const result = await AtomicSoulNetService.getAtomicData(userId, timeRange, 'en');
      
      if (!result) {
        console.log('[useAtomicSoulNetData] ENHANCED LOADING: No graph data available');
        setGraphData({ nodes: [], links: [] });
        setConnectionPercentages(new Map());
        setNodeConnectionData(new Map());
        setTranslations(new Map());
        setCanRender(false);
        setIsCacheReady(false);
        setLoading(false);
        return;
      }

      // Set graph data immediately
      setGraphData({ nodes: result.nodes, links: result.links });
      setConnectionPercentages(result.connectionPercentages);
      setNodeConnectionData(result.nodeConnectionData);

      const nodeIds = result.nodes.map(node => node.id);
      console.log(`[useAtomicSoulNetData] ENHANCED LOADING: Graph loaded with ${nodeIds.length} nodes`);

      // Step 2: Enhanced translation loading with pre-translation cache support
      const loadedTranslations = await preloadCachedTranslations(nodeIds);

      // Step 3: Enhanced rendering criteria with cache awareness
      const cacheValidation = validateCacheCompleteness(nodeIds, loadedTranslations, currentLanguage);
      setCanRender(cacheValidation.canRender);

      console.log(`[useAtomicSoulNetData] ENHANCED LOADING: Can render: ${cacheValidation.canRender}, cache ready: ${cacheValidation.isCacheComplete}, translations: ${loadedTranslations.size}/${nodeIds.length}`);
      
      setLoading(false);
    } catch (err) {
      console.error('[useAtomicSoulNetData] ENHANCED LOADING: Error loading data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      setCanRender(false);
      setIsCacheReady(false);
      setLoading(false);
    }
  }, [userId, timeRange, currentLanguage, preloadCachedTranslations, validateCacheCompleteness]);

  // Start pre-translation when component mounts or language changes
  useEffect(() => {
    preTranslateAllNodes();
  }, [preTranslateAllNodes]);

  // Load data when dependencies change, but wait for pre-translation if needed
  useEffect(() => {
    if (currentLanguage === 'en' || !isPreTranslating) {
      loadAllData();
    }
  }, [loadAllData, isPreTranslating, currentLanguage]);

  // Listen for translation completion with cache validation
  useEffect(() => {
    const handleTranslationComplete = async (event: CustomEvent) => {
      const stateKey = `${userId}-${currentLanguage}`;
      if (event.detail.stateKey === stateKey) {
        console.log('[useAtomicSoulNetData] TRANSLATION COMPLETE: Updating translations and validating cache');
        
        const nodeIds = graphData.nodes.map(node => node.id);
        if (nodeIds.length > 0) {
          const updatedTranslations = await preloadCachedTranslations(nodeIds);
          const cacheValidation = validateCacheCompleteness(nodeIds, updatedTranslations, currentLanguage);
          
          setCanRender(cacheValidation.canRender);
          setIsCacheReady(cacheValidation.isCacheComplete);
          
          console.log(`[useAtomicSoulNetData] TRANSLATION COMPLETE: Cache ready: ${cacheValidation.isCacheComplete}, can render: ${cacheValidation.canRender}`);
        }
      }
    };

    window.addEventListener('soulNetTranslationComplete', handleTranslationComplete as EventListener);
    
    return () => {
      window.removeEventListener('soulNetTranslationComplete', handleTranslationComplete as EventListener);
    };
  }, [userId, currentLanguage, graphData.nodes, preloadCachedTranslations, validateCacheCompleteness]);

  // Get node translation with pre-translation cache support
  const getNodeTranslation = useCallback((nodeId: string): string => {
    const cached = translations.get(nodeId);
    if (cached) {
      return cached;
    }
    
    // Fallback to pre-translation cache
    const preCached = preTranslationCache.get(nodeId);
    if (preCached) {
      return preCached;
    }
    
    return nodeId;
  }, [translations, preTranslationCache]);

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

  // Enhanced state logging
  console.log(`[useAtomicSoulNetData] ENHANCED STATE: nodes=${graphData.nodes.length}, translations=${translations.size}, preCache=${preTranslationCache.size}, loading=${loading}, preTranslating=${isPreTranslating}, progress=${preTranslationProgress}%, translating=${isTranslating}, canRender=${canRender}, cacheReady=${isCacheReady} (${currentLanguage})`);

  return {
    graphData,
    translations,
    connectionPercentages,
    nodeConnectionData,
    loading,
    error,
    isTranslating: isPreTranslating || isTranslating, // Show loader during pre-translation or regular translation
    translationProgress: isPreTranslating ? preTranslationProgress : translationProgress, // Use pre-translation progress when active
    translationComplete,
    canRender: canRender && !isPreTranslating, // Don't render during pre-translation
    isCacheReady: isCacheReady && !isPreTranslating, // Cache not ready during pre-translation
    getNodeTranslation,
    getConnectionPercentage,
    getNodeConnections
  };
};
