
import { useState, useEffect, useCallback, useRef } from 'react';
import { EnhancedSoulNetPreloadService } from '@/services/enhancedSoulNetPreloadService';
import { LanguageLevelTranslationCache } from '@/services/languageLevelTranslationCache';
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

interface UseInstantSoulNetDataReturn {
  graphData: { nodes: NodeData[], links: LinkData[] };
  loading: boolean;
  error: Error | null;
  isInstantReady: boolean;
  isTranslating: boolean;
  translationProgress: number;
  translationComplete: boolean;
  isAtomicMode: boolean;
  getInstantConnectionPercentage: (sourceId: string, targetId: string) => number;
  getInstantTranslation: (originalText: string) => string;
  getInstantNodeConnections: (nodeId: string) => string[];
}

export const useInstantSoulNetData = (
  userId: string | undefined,
  timeRange: string
): UseInstantSoulNetDataReturn => {
  const { currentLanguage } = useTranslation();
  
  const [graphData, setGraphData] = useState<{ nodes: NodeData[], links: LinkData[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isInstantReady, setIsInstantReady] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(100);
  const [translationComplete, setTranslationComplete] = useState(true);
  
  // Enhanced state storage
  const [translations, setTranslations] = useState<Map<string, string>>(new Map());
  const [connectionPercentages, setConnectionPercentages] = useState<Map<string, number>>(new Map());
  const [nodeConnectionData, setNodeConnectionData] = useState<Map<string, NodeConnectionData>>(new Map());
  
  // Ref to track data loading to prevent race conditions
  const loadingDataRef = useRef<string>('');
  const isAtomicMode = true; // Always use atomic mode for consistency

  console.log(`[useInstantSoulNetData] LANGUAGE-LEVEL: Hook state - userId: ${userId}, timeRange: ${timeRange}, language: ${currentLanguage}, nodes: ${graphData.nodes.length}, isReady: ${isInstantReady}, translating: ${isTranslating}, complete: ${translationComplete}`);

  // ENHANCED: Language-level instant data loading
  const loadInstantData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setIsInstantReady(false);
      return;
    }

    const requestKey = `${userId}-${timeRange}-${currentLanguage}`;
    
    // Prevent race conditions
    if (loadingDataRef.current === requestKey) {
      console.log(`[useInstantSoulNetData] LANGUAGE-LEVEL: Request already in progress for ${requestKey}`);
      return;
    }
    
    loadingDataRef.current = requestKey;
    
    console.log(`[useInstantSoulNetData] LANGUAGE-LEVEL: Loading instant data for ${requestKey}`);
    
    try {
      setError(null);
      
      // Check language-level translation status
      const languageTranslationState = EnhancedSoulNetPreloadService.getLanguageTranslationState(userId, currentLanguage);
      
      console.log(`[useInstantSoulNetData] LANGUAGE-LEVEL: Language translation state for ${currentLanguage}:`, languageTranslationState);
      
      setIsTranslating(languageTranslationState.isTranslating);
      setTranslationProgress(languageTranslationState.progress);
      setTranslationComplete(languageTranslationState.isComplete);
      
      // If translation is in progress, show loading but don't block
      if (languageTranslationState.isTranslating) {
        console.log(`[useInstantSoulNetData] LANGUAGE-LEVEL: Translation in progress for ${currentLanguage}, progress: ${languageTranslationState.progress}%`);
        setLoading(true);
        setIsInstantReady(false);
      }
      
      // Try to get instant data
      const result = await EnhancedSoulNetPreloadService.preloadInstantData(
        userId,
        timeRange,
        currentLanguage
      );

      // Check if this is still the current request
      if (loadingDataRef.current !== requestKey) {
        console.log(`[useInstantSoulNetData] LANGUAGE-LEVEL: Request ${requestKey} was superseded, ignoring result`);
        return;
      }

      if (result) {
        console.log(`[useInstantSoulNetData] LANGUAGE-LEVEL: Successfully loaded data for ${requestKey} with ${result.nodes.length} nodes, translation complete: ${result.translationComplete}`);
        
        setGraphData({ nodes: result.nodes, links: result.links });
        setTranslations(result.translations);
        setConnectionPercentages(result.connectionPercentages);
        setNodeConnectionData(result.nodeConnectionData);
        setTranslationProgress(result.translationProgress);
        setTranslationComplete(result.translationComplete);
        setIsTranslating(false);
        setIsInstantReady(true);
        setLoading(false);
      } else {
        console.log(`[useInstantSoulNetData] LANGUAGE-LEVEL: No data returned for ${requestKey}`);
        setGraphData({ nodes: [], links: [] });
        setTranslations(new Map());
        setConnectionPercentages(new Map());
        setNodeConnectionData(new Map());
        setIsInstantReady(true);
        setLoading(false);
        setIsTranslating(false);
        setTranslationComplete(true);
        setTranslationProgress(100);
      }
    } catch (err) {
      console.error(`[useInstantSoulNetData] LANGUAGE-LEVEL: Error loading data for ${requestKey}:`, err);
      if (loadingDataRef.current === requestKey) {
        setError(err instanceof Error ? err : new Error('Unknown error occurred'));
        setLoading(false);
        setIsInstantReady(false);
        setIsTranslating(false);
      }
    } finally {
      if (loadingDataRef.current === requestKey) {
        loadingDataRef.current = '';
      }
    }
  }, [userId, timeRange, currentLanguage]);

  // ENHANCED: Effect to handle data loading with language coordination
  useEffect(() => {
    console.log(`[useInstantSoulNetData] LANGUAGE-LEVEL: Effect triggered - userId: ${userId}, timeRange: ${timeRange}, language: ${currentLanguage}`);
    
    // Reset state for new request
    setLoading(true);
    setIsInstantReady(false);
    setError(null);
    
    loadInstantData();
  }, [loadInstantData]);

  // OPTIMIZED: Clear cache when language changes
  useEffect(() => {
    if (userId) {
      console.log(`[useInstantSoulNetData] LANGUAGE-LEVEL: Language changed to ${currentLanguage}, clearing cache for fresh translations`);
      EnhancedSoulNetPreloadService.clearInstantCache(userId);
      LanguageLevelTranslationCache.clearLanguageCache(userId);
    }
  }, [currentLanguage, userId]);

  // ENHANCED: Instant access functions using cached data
  const getInstantConnectionPercentage = useCallback((sourceId: string, targetId: string): number => {
    const key = `${sourceId}-${targetId}`;
    const percentage = connectionPercentages.get(key);
    return percentage || 0;
  }, [connectionPercentages]);

  const getInstantTranslation = useCallback((originalText: string): string => {
    if (currentLanguage === 'en') {
      return originalText;
    }
    
    const translated = translations.get(originalText);
    if (translated) {
      return translated;
    }
    
    // Fallback: check language-level cache directly
    if (userId) {
      const languageTranslations = LanguageLevelTranslationCache.getLanguageTranslations(userId, currentLanguage);
      const languageTranslation = languageTranslations.get(originalText);
      if (languageTranslation) {
        return languageTranslation;
      }
    }
    
    return originalText;
  }, [translations, currentLanguage, userId]);

  const getInstantNodeConnections = useCallback((nodeId: string): string[] => {
    const connectionData = nodeConnectionData.get(nodeId);
    return connectionData?.connectedNodes || [];
  }, [nodeConnectionData]);

  return {
    graphData,
    loading,
    error,
    isInstantReady,
    isTranslating,
    translationProgress,
    translationComplete,
    isAtomicMode,
    getInstantConnectionPercentage,
    getInstantTranslation,
    getInstantNodeConnections
  };
};
