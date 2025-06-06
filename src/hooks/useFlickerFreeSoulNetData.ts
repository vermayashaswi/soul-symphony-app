
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
  getInstantConnectionPercentage: (nodeId: string, connectedNodeId: string) => number;
  getInstantTranslation: (text: string) => string;
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
  
  const preloadedDataRef = useRef<any>(null);
  const connectionsMapRef = useRef<Map<string, Set<string>>>(new Map());
  const percentagesMapRef = useRef<Map<string, number>>(new Map());

  console.log('[useFlickerFreeSoulNetData] FLICKER-FREE MODE:', {
    userId,
    timeRange,
    language: currentLanguage,
    nodesCount: graphData.nodes.length,
    isReady,
    isTranslationsReady
  });

  // Instant connection percentage lookup
  const getInstantConnectionPercentage = useCallback((nodeId: string, connectedNodeId: string): number => {
    const key = `${nodeId}-${connectedNodeId}`;
    return percentagesMapRef.current.get(key) || 0;
  }, []);

  // Instant translation lookup
  const getInstantTranslation = useCallback((text: string): string => {
    if (!userId || currentLanguage === 'en') return text;
    
    const translation = SoulNetTranslationPreloader.getTranslationSync(
      text, 
      currentLanguage, 
      userId, 
      timeRange
    );
    
    return translation || text;
  }, [userId, currentLanguage, timeRange]);

  // Instant node connections lookup
  const getInstantNodeConnections = useCallback((nodeId: string): Set<string> => {
    return connectionsMapRef.current.get(nodeId) || new Set();
  }, []);

  // Preload translations in parallel with data loading
  useEffect(() => {
    let mounted = true;

    const preloadTranslations = async () => {
      if (!userId || currentLanguage === 'en') {
        setIsTranslationsReady(true);
        return;
      }

      console.log(`[useFlickerFreeSoulNetData] Preloading translations for ${currentLanguage}`);
      
      try {
        const translationsData = await SoulNetTranslationPreloader.preloadSoulNetTranslations(
          userId,
          timeRange,
          currentLanguage
        );

        if (mounted) {
          if (translationsData) {
            console.log(`[useFlickerFreeSoulNetData] Translations preloaded successfully`);
            setIsTranslationsReady(true);
          } else {
            console.log(`[useFlickerFreeSoulNetData] No translations needed`);
            setIsTranslationsReady(true);
          }
        }
      } catch (error) {
        console.error(`[useFlickerFreeSoulNetData] Translation preloading failed:`, error);
        if (mounted) {
          setIsTranslationsReady(true); // Continue without translations
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

      console.log(`[useFlickerFreeSoulNetData] Loading SoulNet data for ${userId}, ${timeRange}`);
      setLoading(true);
      setError(null);

      try {
        const data = await SoulNetPreloadService.preloadSoulNetData(userId, timeRange, 'en');
        
        if (!mounted) return;

        if (data && data.nodes.length > 0) {
          console.log(`[useFlickerFreeSoulNetData] Data loaded: ${data.nodes.length} nodes, ${data.links.length} links`);
          
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
            
            // Build percentages map from preloaded data
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
          console.log(`[useFlickerFreeSoulNetData] No data available`);
          setGraphData({ nodes: [], links: [] });
          setIsReady(false);
        }
        
        setLoading(false);
      } catch (err) {
        console.error(`[useFlickerFreeSoulNetData] Error loading data:`, err);
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
    getInstantConnectionPercentage,
    getInstantTranslation,
    getInstantNodeConnections
  };
}
