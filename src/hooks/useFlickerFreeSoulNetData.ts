
import { useState, useEffect, useCallback, useRef } from 'react';
import { TimeRange } from '@/hooks/use-insights-data';
import { SoulNetPreloadService } from '@/services/soulnetPreloadService';
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
  retryCount: number;
  incrementRetry: () => void;
  retryTranslations: () => Promise<void>;
  getInstantConnectionPercentage: (nodeId: string, connectedNodeId: string) => number;
  getInstantTranslation: (text: string) => string | null;
  getInstantNodeConnections: (nodeId: string) => Set<string>;
}

export function useFlickerFreeSoulNetData(
  userId: string | undefined,
  timeRange: TimeRange
): UseFlickerFreeSoulNetDataReturn {
  const { currentLanguage, translate } = useTranslation();
  const [graphData, setGraphData] = useState<FlickerFreeSoulNetData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const preloadedDataRef = useRef<any>(null);
  const connectionsMapRef = useRef<Map<string, Set<string>>>(new Map());
  const percentagesMapRef = useRef<Map<string, number>>(new Map());
  const translationCacheRef = useRef<Map<string, string>>(new Map());

  console.log('[useFlickerFreeSoulNetData] HOOK STATE:', {
    userId,
    timeRange,
    language: currentLanguage,
    nodesCount: graphData.nodes.length,
    isReady,
    retryCount
  });

  // Instant connection percentage lookup
  const getInstantConnectionPercentage = useCallback((nodeId: string, connectedNodeId: string): number => {
    const key = `${nodeId}-${connectedNodeId}`;
    return percentagesMapRef.current.get(key) || 0;
  }, []);

  // Robust instant translation lookup using local cache
  const getInstantTranslation = useCallback((text: string): string | null => {
    // For English, always return the original text
    if (currentLanguage === 'en') {
      return text;
    }
    
    if (!userId || !text || typeof text !== 'string' || text.trim().length === 0) {
      console.log(`[useFlickerFreeSoulNetData] Invalid input for translation: "${text}"`);
      return null;
    }
    
    const cacheKey = `${text.trim()}-${currentLanguage}`;
    const cached = translationCacheRef.current.get(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    console.log(`[useFlickerFreeSoulNetData] NO CACHED TRANSLATION: "${text}" in ${currentLanguage}`);
    return null;
  }, [userId, currentLanguage]);

  // Instant node connections lookup
  const getInstantNodeConnections = useCallback((nodeId: string): Set<string> => {
    return connectionsMapRef.current.get(nodeId) || new Set();
  }, []);

  // Increment retry counter
  const incrementRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
  }, []);

  // Enhanced retry mechanism for translations
  const retryTranslations = useCallback(async () => {
    if (!userId) {
      console.log('[useFlickerFreeSoulNetData] Cannot retry translations: no userId');
      return;
    }

    if (currentLanguage === 'en') {
      console.log('[useFlickerFreeSoulNetData] English language, no translation needed');
      return;
    }

    if (!translate) {
      console.log('[useFlickerFreeSoulNetData] No translate function available');
      return;
    }

    console.log(`[useFlickerFreeSoulNetData] RETRYING translations (attempt ${retryCount + 1})`);
    
    try {
      // Clear old cache before retry
      translationCacheRef.current.clear();
      
      // Get all node texts that need translation
      const nodeTexts = preloadedDataRef.current?.nodes.map((node: NodeData) => node.id) || [];
      
      if (nodeTexts.length === 0) {
        console.log('[useFlickerFreeSoulNetData] No node texts to translate');
        return;
      }
      
      // Translate all node texts with robust error handling
      const translationPromises = nodeTexts.map(async (text: string) => {
        try {
          if (!text || typeof text !== 'string' || text.trim().length === 0) {
            console.warn(`[useFlickerFreeSoulNetData] Skipping invalid text: "${text}"`);
            return { text, translated: text };
          }

          const translated = await translate(text.trim());
          const cacheKey = `${text.trim()}-${currentLanguage}`;
          
          if (translated && typeof translated === 'string' && translated.trim().length > 0) {
            translationCacheRef.current.set(cacheKey, translated.trim());
            return { text, translated: translated.trim() };
          } else {
            translationCacheRef.current.set(cacheKey, text.trim());
            return { text, translated: text.trim() };
          }
        } catch (error) {
          console.error(`[useFlickerFreeSoulNetData] Failed to translate "${text}":`, error);
          const cacheKey = `${text.trim()}-${currentLanguage}`;
          translationCacheRef.current.set(cacheKey, text.trim());
          return { text, translated: text.trim() };
        }
      });
      
      const results = await Promise.all(translationPromises);
      
      console.log(`[useFlickerFreeSoulNetData] RETRY SUCCESS: ${results.length} translations processed`);
      setRetryCount(prev => prev + 1);
      
    } catch (error) {
      console.error(`[useFlickerFreeSoulNetData] RETRY ERROR:`, error);
    }
  }, [userId, currentLanguage, translate, retryCount]);

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
    retryCount,
    incrementRetry,
    retryTranslations,
    getInstantConnectionPercentage,
    getInstantTranslation,
    getInstantNodeConnections
  };
}
