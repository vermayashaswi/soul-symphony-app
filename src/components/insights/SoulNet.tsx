import React, { useState, useEffect, useCallback, useRef } from 'react';
import '@/types/three-reference';
import { Canvas } from '@react-three/fiber';
import { TimeRange } from '@/hooks/use-insights-data';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import SimplifiedSoulNetVisualization from './soulnet/SimplifiedSoulNetVisualization';
import RenderingErrorBoundary from './soulnet/RenderingErrorBoundary';
import FallbackVisualization from './soulnet/FallbackVisualization';
import { LoadingState } from './soulnet/LoadingState';
import { EmptyState } from './soulnet/EmptyState';
import { FullscreenWrapper } from './soulnet/FullscreenWrapper';
import SoulNetDescription from './soulnet/SoulNetDescription';
import { useUserColorThemeHex } from './soulnet/useUserColorThemeHex';
import { isWebGLCompatible, detectWebGLCapabilities } from '@/utils/webgl-detection';
import { cn } from '@/lib/utils';
import { TranslatableText } from '@/components/translation/TranslatableText';

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

interface SoulNetProps {
  userId: string | undefined;
  timeRange: TimeRange;
}

const SoulNet: React.FC<SoulNetProps> = ({ userId, timeRange }) => {
  const [graphData, setGraphData] = useState<{nodes: NodeData[], links: LinkData[]}>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dataError, setDataError] = useState<Error | null>(null);
  const [canvasError, setCanvasError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [hasData, setHasData] = useState(false);
  const [useWebGL, setUseWebGL] = useState(true);
  const [webglCapabilities, setWebglCapabilities] = useState<any>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  
  const isMobile = useIsMobile();
  const themeHex = useUserColorThemeHex();
  const mountedRef = useRef<boolean>(true);

  console.log("[SoulNet] Render state:", { 
    userId, 
    timeRange, 
    hasData,
    nodeCount: graphData.nodes.length,
    loading,
    dataError: !!dataError,
    canvasError: !!canvasError,
    retryCount,
    useWebGL,
    webglCapabilities: !!webglCapabilities,
    canvasReady
  });

  // Check WebGL compatibility on mount with enhanced detection
  useEffect(() => {
    try {
      const isCompatible = isWebGLCompatible();
      const capabilities = detectWebGLCapabilities();
      
      console.log("[SoulNet] WebGL compatibility check:", { isCompatible, capabilities });
      
      setUseWebGL(isCompatible);
      setWebglCapabilities(capabilities);
      
      if (!isCompatible) {
        console.warn("[SoulNet] WebGL not compatible, using fallback visualization");
      }
    } catch (error) {
      console.error("[SoulNet] Error checking WebGL compatibility:", error);
      setUseWebGL(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Enhanced data fetching with better error handling
  useEffect(() => {
    if (!userId || !mountedRef.current) {
      console.log("[SoulNet] No userId or component unmounted, skipping fetch");
      setLoading(false);
      setHasData(false);
      return;
    }

    const fetchData = async () => {
      try {
        console.log("[SoulNet] Starting enhanced data fetch for userId:", userId, "timeRange:", timeRange);
        setLoading(true);
        setDataError(null);
        setCanvasError(null);
        
        const startDate = getStartDate(timeRange);
        console.log("[SoulNet] Fetching entries from:", startDate.toISOString());
        
        const { data: entries, error } = await supabase
          .from('Journal Entries')
          .select('id, entityemotion, "refined text", "transcription text"')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false });

        if (!mountedRef.current) {
          console.log("[SoulNet] Component unmounted during fetch");
          return;
        }

        if (error) {
          console.error("[SoulNet] Database error:", error);
          throw error;
        }

        console.log(`[SoulNet] Fetched ${entries?.length || 0} entries`);
        
        if (!entries || entries.length === 0) {
          console.log("[SoulNet] No entries found");
          setGraphData({ nodes: [], links: [] });
          setHasData(false);
        } else {
          console.log("[SoulNet] Processing entries into graph data");
          const processedData = processEntities(entries);
          console.log("[SoulNet] Processed data:", processedData);
          setGraphData(processedData);
          setHasData(processedData.nodes.length > 0);
        }
        
      } catch (error) {
        if (!mountedRef.current) return;
        console.error('[SoulNet] Data fetch error:', error);
        setDataError(error instanceof Error ? error : new Error('Unknown error'));
        setHasData(false);
      } finally {
        if (mountedRef.current) {
          console.log("[SoulNet] Setting loading to false");
          setLoading(false);
        }
      }
    };

    fetchData();
  }, [userId, timeRange]);

  const handleNodeSelect = useCallback((id: string) => {
    try {
      console.log("[SoulNet] Node selected:", id);
      if (selectedNode === id) {
        setSelectedNode(null);
      } else {
        setSelectedNode(id);
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
    } catch (error) {
      console.error('[SoulNet] Error handling node selection:', error);
    }
  }, [selectedNode]);

  const toggleFullScreen = useCallback(() => {
    try {
      setIsFullScreen(prev => {
        if (!prev) setSelectedNode(null);
        return !prev;
      });
    } catch (error) {
      console.error('[SoulNet] Error toggling fullscreen:', error);
    }
  }, []);

  const handleCanvasError = useCallback((error: Error) => {
    console.error('[SoulNet] Canvas error:', error);
    setCanvasError(error);
    setRetryCount(prev => prev + 1);
    setCanvasReady(false);
    
    // If we get repeated Canvas errors, switch to fallback
    if (retryCount > 2) {
      console.log('[SoulNet] Multiple Canvas errors, switching to fallback');
      setUseWebGL(false);
    }
  }, [retryCount]);

  const handleRetry = useCallback(() => {
    console.log('[SoulNet] Manual retry');
    setCanvasError(null);
    setDataError(null);
    setRetryCount(0);
    setCanvasReady(false);
    
    // Reset WebGL attempt
    const isCompatible = isWebGLCompatible();
    setUseWebGL(isCompatible);
  }, []);

  const handleCanvasCreated = useCallback((state: any) => {
    try {
      console.log('[SoulNet] Canvas created successfully', state);
      setCanvasReady(true);
    } catch (error) {
      console.error('[SoulNet] Error in canvas creation handler:', error);
    }
  }, []);

  // Show loading state only while actively loading
  if (loading) {
    console.log("[SoulNet] Rendering loading state");
    return (
      <div className="bg-background rounded-xl shadow-sm border w-full p-6">
        <LoadingState />
      </div>
    );
  }
  
  // Show data error
  if (dataError) {
    console.log("[SoulNet] Rendering data error state");
    return (
      <div className="bg-background rounded-xl shadow-sm border w-full p-6">
        <h2 className="text-xl font-semibold text-red-600 mb-4">
          <TranslatableText text="Error Loading Soul-Net" />
        </h2>
        <p className="text-muted-foreground mb-4">{dataError.message}</p>
        <button 
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors" 
          onClick={handleRetry}
        >
          <TranslatableText text="Retry" />
        </button>
      </div>
    );
  }
  
  // Show empty state only if we have no data at all
  if (!hasData) {
    console.log("[SoulNet] Rendering empty state - no data available");
    return <EmptyState />;
  }

  // Show persistent canvas error only after multiple retries
  if (canvasError && retryCount > 3) {
    console.log("[SoulNet] Rendering canvas error state after", retryCount, "retries");
    return (
      <div className="bg-background rounded-xl shadow-sm border w-full p-6">
        <h2 className="text-xl font-semibold mb-4">
          <TranslatableText text="Soul-Net Visualization" />
        </h2>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">
            <TranslatableText text="3D Visualization Temporarily Unavailable" />
          </h3>
          <p className="text-yellow-700 dark:text-yellow-400 mb-3">
            <TranslatableText text="The visualization is being optimized for better performance. Your data is safe." />
          </p>
          <button
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
            onClick={handleRetry}
          >
            <TranslatableText text="Try Again" />
          </button>
        </div>
      </div>
    );
  }

  const getInstructions = () => {
    if (isMobile) {
      return <TranslatableText text="Drag to rotate • Pinch to zoom • Tap a node to highlight connections" forceTranslate={true} />;
    }
    return <TranslatableText text="Drag to rotate • Scroll to zoom • Click a node to highlight connections" forceTranslate={true} />;
  };

  // Main render with enhanced WebGL detection and fallback
  console.log("[SoulNet] Rendering visualization with", graphData.nodes.length, "nodes, WebGL:", useWebGL, "Canvas ready:", canvasReady);
  
  return (
    <div className={cn(
      "bg-background rounded-xl shadow-sm border w-full relative",
      isMobile ? "p-0" : "p-6 md:p-8"
    )}>
      {!isFullScreen && <SoulNetDescription />}
      
      <FullscreenWrapper
        isFullScreen={isFullScreen}
        toggleFullScreen={toggleFullScreen}
      >
        <div style={{
          width: '100%',
          height: '100%',
          maxWidth: isFullScreen ? 'none' : '800px',
          maxHeight: isFullScreen ? 'none' : '500px',
          position: 'relative',
          zIndex: 5,
          minHeight: '400px'
        }}>
          {!useWebGL ? (
            // Fallback visualization for non-WebGL environments
            <FallbackVisualization
              data={graphData}
              selectedNode={selectedNode}
              onNodeClick={handleNodeSelect}
              themeHex={themeHex}
            />
          ) : (
            // Enhanced WebGL Canvas visualization
            <RenderingErrorBoundary
              onError={handleCanvasError}
              fallback={
                <div className="flex items-center justify-center p-10 bg-gray-100 dark:bg-gray-800 rounded-lg h-full">
                  <div className="text-center">
                    <h3 className="text-lg font-medium">
                      <TranslatableText text="Visualization Error" />
                    </h3>
                    <p className="text-muted-foreground mt-2">
                      <TranslatableText text="Switching to alternative view..." />
                    </p>
                    <button 
                      className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                      onClick={() => setUseWebGL(false)}
                    >
                      <TranslatableText text="Use Alternative View" />
                    </button>
                  </div>
                </div>
              }
            >
              <Canvas
                style={{
                  width: '100%',
                  height: '100%'
                }}
                camera={{ 
                  position: [0, 0, isFullScreen ? 40 : 45],
                  near: 1, 
                  far: 1000,
                  fov: isFullScreen ? 60 : 50
                }}
                onPointerMissed={() => {
                  try {
                    setSelectedNode(null);
                  } catch (error) {
                    console.warn('[SoulNet] Error clearing selection:', error);
                  }
                }}
                gl={{ 
                  preserveDrawingBuffer: true,
                  antialias: !isMobile,
                  powerPreference: 'high-performance',
                  alpha: true,
                  depth: true,
                  stencil: false,
                  precision: isMobile ? 'mediump' : 'highp'
                }}
                onCreated={handleCanvasCreated}
                onError={handleCanvasError}
              >
                <SimplifiedSoulNetVisualization
                  data={graphData}
                  selectedNode={selectedNode}
                  onNodeClick={handleNodeSelect}
                  themeHex={themeHex}
                  isFullScreen={isFullScreen}
                  shouldShowLabels={true}
                />
              </Canvas>
            </RenderingErrorBoundary>
          )}
        </div>
      </FullscreenWrapper>
      
      {!isFullScreen && (
        <div className="w-full text-center mt-2 px-4 md:px-8">
          <p className="text-xs text-muted-foreground">
            {getInstructions()}
          </p>
          {!useWebGL && (
            <p className="text-xs text-muted-foreground mt-1">
              <TranslatableText text="Using compatibility mode" />
            </p>
          )}
          {useWebGL && !canvasReady && (
            <p className="text-xs text-muted-foreground mt-1">
              <TranslatableText text="Initializing 3D visualization..." />
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const getStartDate = (range: TimeRange) => {
  const now = new Date();
  switch (range) {
    case 'today':
      return new Date(now.setHours(0, 0, 0, 0));
    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);
      return weekStart;
    case 'month':
      const monthStart = new Date(now);
      monthStart.setMonth(monthStart.getMonth() - 1);
      return monthStart;
    case 'year':
      const yearStart = new Date(now);
      yearStart.setFullYear(yearStart.getFullYear() - 1);
      return yearStart;
    default:
      const defaultStart = new Date(now);
      defaultStart.setDate(defaultStart.getDate() - 7);
      return defaultStart;
  }
};

const processEntities = (entries: any[]) => {
  console.log("[SoulNet] Processing entities for", entries.length, "entries");
  
  const entityEmotionMap: Record<string, {emotions: Record<string, number>}> = {};
  let processedEntries = 0;
  
  entries.forEach(entry => {
    if (!entry.entityemotion) {
      console.log("[SoulNet] Entry missing entityemotion:", entry.id);
      return;
    }
    
    try {
      const entityEmotion = typeof entry.entityemotion === 'string' 
        ? JSON.parse(entry.entityemotion) 
        : entry.entityemotion;
      
      Object.entries(entityEmotion).forEach(([category, emotions]) => {
        if (typeof emotions !== 'object') return;
        Object.entries(emotions).forEach(([emotion, score]) => {
          if (typeof score !== 'number') return;
          if (!entityEmotionMap[category]) {
            entityEmotionMap[category] = { emotions: {} };
          }
          if (entityEmotionMap[category].emotions[emotion]) {
            entityEmotionMap[category].emotions[emotion] =
              (entityEmotionMap[category].emotions[emotion] + score) / 2;
          } else {
            entityEmotionMap[category].emotions[emotion] = score;
          }
        });
      });
      processedEntries++;
    } catch (error) {
      console.error("[SoulNet] Error processing entry entityemotion:", error, entry.id);
    }
  });

  console.log("[SoulNet] Processed", processedEntries, "entries, entity emotion map:", entityEmotionMap);
  return generateGraph(entityEmotionMap);
};

const generateGraph = (entityEmotionMap: Record<string, {emotions: Record<string, number>}>) => {
  const nodes: NodeData[] = [];
  const links: LinkData[] = [];
  const entityNodes = new Set<string>();
  const emotionNodes = new Set<string>();

  const entityList = Object.keys(entityEmotionMap);
  console.log("[SoulNet] Generating graph with", entityList.length, "entities");
  
  if (entityList.length === 0) {
    console.log("[SoulNet] No entities found, returning empty graph");
    return { nodes: [], links: [] };
  }

  const EMOTION_LAYER_RADIUS = 11;
  const ENTITY_LAYER_RADIUS = 6;
  const EMOTION_Y_SPAN = 6;
  const ENTITY_Y_SPAN = 3;
  
  entityList.forEach((entity, entityIndex) => {
    entityNodes.add(entity);
    const entityAngle = (entityIndex / entityList.length) * Math.PI * 2;
    const entityRadius = ENTITY_LAYER_RADIUS;
    const entityX = Math.cos(entityAngle) * entityRadius;
    const entityY = ((entityIndex % 2) === 0 ? -1 : 1) * 0.7 * (Math.random() - 0.5) * ENTITY_Y_SPAN;
    const entityZ = Math.sin(entityAngle) * entityRadius;
    
    nodes.push({
      id: entity,
      type: 'entity',
      value: 1,
      color: '#fff',
      position: [entityX, entityY, entityZ]
    });

    Object.entries(entityEmotionMap[entity].emotions).forEach(([emotion, score]) => {
      emotionNodes.add(emotion);
      links.push({
        source: entity,
        target: emotion,
        value: score
      });
    });
  });

  Array.from(emotionNodes).forEach((emotion, emotionIndex) => {
    const emotionAngle = (emotionIndex / emotionNodes.size) * Math.PI * 2;
    const emotionRadius = EMOTION_LAYER_RADIUS;
    const emotionX = Math.cos(emotionAngle) * emotionRadius;
    const emotionY = ((emotionIndex % 2) === 0 ? -1 : 1) * 0.7 * (Math.random() - 0.5) * EMOTION_Y_SPAN;
    const emotionZ = Math.sin(emotionAngle) * emotionRadius;
    
    nodes.push({
      id: emotion,
      type: 'emotion',
      value: 0.8,
      color: '#fff',
      position: [emotionX, emotionY, emotionZ]
    });
  });

  console.log("[SoulNet] Generated graph with", nodes.length, "nodes and", links.length, "links");
  return { nodes, links };
};

export default SoulNet;
