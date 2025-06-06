
import { useState, useEffect, useCallback, useRef } from 'react';
import { TimeRange } from '@/hooks/use-insights-data';
import { SoulNetPreloadService } from '@/services/soulnetPreloadService';
import { SoulNetTranslationPreloader } from '@/services/soulnetTranslationPreloader';
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

interface FlickerFreeSoulNetData {
  nodes: NodeData[];
  links: LinkData[];
}

interface UseFlickerFreeSoulNetDataReturn {
  graphData: FlickerFreeSoulNetData;
  loading: boolean;
  error: Error | null;
  isReady: boolean;
  isTranslationsReady: boolean;
  translationProgress: number;
  retryTranslations: () => Promise<void>;
  getInstantConnectionPercentage: (nodeId: string, connectedNodeId: string) => number;
  getInstantTranslation: (text: string) => string | null;
  getInstantNodeConnections: (nodeId: string) => Set<string>;
}

export function useFlickerFreeSoulNetData(
  userId: string | undefined,
  timeRange: TimeRange
): UseFlickerFreeSoulNetDataReturn {
  const { currentLanguage } = useTranslation();
  const [graphData, setGraphData] = useState<FlickerFreeSoulNetData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isTranslationsReady, setIsTranslationsReady] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);
  
  const preloadedDataRef = useRef<any>(null);
  const connectionsMapRef = useRef<Map<string, Set<string>>>(new Map());
  const percentagesMapRef = useRef<Map<string, number>>(new Map());
  const retryCountRef = useRef(0);

  console.log('[useFlickerFreeSoulNetData] STRICT MODE:', {
    userId,
    timeRange,
    language: currentLanguage,
    nodesCount: graphData.nodes.length,
    isReady,
    isTranslationsReady,
    translationProgress,
    retryCount: retryCountRef.current
  });

  // Instant connection percentage lookup
  const getInstantConnectionPercentage = useCallback((nodeId: string, connectedNodeId: string): number => {
    const key = `${nodeId}-${connectedNodeId}`;
    return percentagesMapRef.current.get(key) || 0;
  }, []);

  // STRICT: Instant translation lookup - only returns translation if available
  const getInstantTranslation = useCallback((text: string): string | null => {
    // For English, always return the original text
    if (currentLanguage === 'en') {
      return text;
    }
    
    if (!userId) {
      console.log(`[useFlickerFreeSoulNetData] No userId for translation: "${text}"`);
      return null;
    }
    
    const translation = SoulNetTranslationPreloader.getTranslationSync(
      text, 
      currentLanguage, 
      userId, 
      timeRange
    );
    
    // STRICT: Return null if no translation available - NO ENGLISH FALLBACK
    if (!translation) {
      console.log(`[useFlickerFreeSoulNetData] NO TRANSLATION: "${text}" in ${currentLanguage}`);
      return null;
    }
    
    return translation;
  }, [userId, currentLanguage, timeRange]);

  // Instant node connections lookup
  const getInstantNodeConnections = useCallback((nodeId: string): Set<string> => {
    return connectionsMapRef.current.get(nodeId) || new Set();
  }, []);

  // ENHANCED: Retry mechanism for translations with proper error handling
  const retryTranslations = useCallback(async () => {
    if (!userId) {
      console.log('[useFlickerFreeSoulNetData] Cannot retry translations: no userId');
      return;
    }

    if (currentLanguage === 'en') {
      setIsTranslationsReady(true);
      setTranslationProgress(100);
      return;
    }

    console.log(`[useFlickerFreeSoulNetData] RETRYING translations (attempt ${retryCountRef.current + 1})`);
    retryCountRef.current += 1;
    setTranslationProgress(0);
    setIsTranslationsReady(false);

    try {
      // Clear old cache before retry
      SoulNetTranslationPreloader.clearCache(userId);
      
      const translationsData = await SoulNetTranslationPreloader.preloadSoulNetTranslations(
        userId,
        timeRange,
        currentLanguage
      );

      if (translationsData && translationsData.nodeTranslations.size > 0) {
        console.log(`[useFlickerFreeSoulNetData] RETRY SUCCESS: ${translationsData.nodeTranslations.size} translations loaded`);
        setTranslationProgress(100);
        setIsTranslationsReady(true);
        retryCountRef.current = 0; // Reset on success
      } else {
        console.warn(`[useFlickerFreeSoulNetData] RETRY FAILED: No translations returned`);
        setIsTranslationsReady(false);
      }
    } catch (error) {
      console.error(`[useFlickerFreeSoulNetData] RETRY ERROR:`, error);
      setIsTranslationsReady(false);
    }
  }, [userId, timeRange, currentLanguage]);

  // ENHANCED: Translation preloading with strict validation
  useEffect(() => {
    let mounted = true;

    const preloadTranslations = async () => {
      if (!userId) {
        setIsTranslationsReady(false);
        setTranslationProgress(0);
        return;
      }

      // For English, we're always ready
      if (currentLanguage === 'en') {
        setIsTranslationsReady(true);
        setTranslationProgress(100);
        return;
      }

      console.log(`[useFlickerFreeSoulNetData] PRELOADING TRANSLATIONS for ${currentLanguage}`);
      setTranslationProgress(10);
      setIsTranslationsReady(false);
      
      try {
        const translationsData = await SoulNetTranslationPreloader.preloadSoulNetTranslations(
          userId,
          timeRange,
          currentLanguage
        );

        if (mounted) {
          if (translationsData && translationsData.nodeTranslations.size > 0) {
            console.log(`[useFlickerFreeSoulNetData] TRANSLATION SUCCESS: ${translationsData.nodeTranslations.size} translations loaded`);
            setTranslationProgress(100);
            setIsTranslationsReady(true);
            retryCountRef.current = 0;
          } else {
            console.warn(`[useFlickerFreeSoulNetData] TRANSLATION FAILED: No translations available`);
            setTranslationProgress(0);
            setIsTranslationsReady(false);
          }
        }
      } catch (error) {
        console.error(`[useFlickerFreeSoulNetData] TRANSLATION ERROR:`, error);
        if (mounted) {
          setTranslationProgress(0);
          setIsTranslationsReady(false);
        }
      }
    };

    preloadTranslations();

    return () => {
      mounted = false;
    };
  }, [userId, timeRange, currentLanguage]);

  // Load SoulNet data
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (!userId) {
        setGraphData({ nodes: [], links: [] });
        setLoading(false);
        setIsReady(false);
        return;
      }

      console.log(`[useFlickerFreeSoulNetData] LOADING DATA for ${userId}, ${timeRange}`);
      setLoading(true);
      setError(null);

      try {
        const data = await SoulNetPreloadService.preloadSoulNetData(userId, timeRange, 'en');
        
        if (!mounted) return;

        if (data && data.nodes.length > 0) {
          console.log(`[useFlickerFreeSoulNetData] DATA LOADED: ${data.nodes.length} nodes, ${data.links.length} links`);
          
          // Store preloaded data
          preloadedDataRef.current = data;
          
          // Build connection maps for instant lookups
          const connectionsMap = new Map<string, Set<string>>();
          const percentagesMap = new Map<string, number>();
          
          data.links.forEach(link => {
            // Build connections map
            if (!connectionsMap.has(link.source)) {
              connectionsMap.set(link.source, new Set());
            }
            if (!connectionsMap.has(link.target)) {
              connectionsMap.set(link.target, new Set());
            }
            
            connectionsMap.get(link.source)?.add(link.target);
            connectionsMap.get(link.target)?.add(link.source);
            
            // Build percentages map
            const sourceKey = `${link.source}-${link.target}`;
            const targetKey = `${link.target}-${link.source}`;
            
            if (data.connectionPercentages.has(sourceKey)) {
              percentagesMap.set(sourceKey, data.connectionPercentages.get(sourceKey)!);
            }
            if (data.connectionPercentages.has(targetKey)) {
              percentagesMap.set(targetKey, data.connectionPercentages.get(targetKey)!);
            }
          });
          
          connectionsMapRef.current = connectionsMap;
          percentagesMapRef.current = percentagesMap;
          
          setGraphData({ nodes: data.nodes, links: data.links });
          setIsReady(true);
        } else {
          console.log(`[useFlickerFreeSoulNetData] NO DATA available`);
          setGraphData({ nodes: [], links: [] });
          setIsReady(false);
        }
        
        setLoading(false);
      } catch (err) {
        console.error(`[useFlickerFreeSoulNetData] DATA ERROR:`, err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to load SoulNet data'));
          setLoading(false);
          setIsReady(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [userId, timeRange]);

  return {
    graphData,
    loading,
    error,
    isReady,
    isTranslationsReady,
    translationProgress,
    retryTranslations,
    getInstantConnectionPercentage,
    getInstantTranslation,
    getInstantNodeConnections
  };
}
