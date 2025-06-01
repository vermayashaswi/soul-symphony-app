import React, { useState, useEffect, useCallback, useRef } from 'react';
import '@/types/three-reference';
import { Canvas } from '@react-three/fiber';
import { TimeRange } from '@/hooks/use-insights-data';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import SimplifiedSoulNetVisualization from './soulnet/SimplifiedSoulNetVisualization';
import RenderingErrorBoundary from './soulnet/RenderingErrorBoundary';
import { LoadingState } from './soulnet/LoadingState';
import { EmptyState } from './soulnet/EmptyState';
import { FullscreenWrapper } from './soulnet/FullscreenWrapper';
import SoulNetDescription from './soulnet/SoulNetDescription';
import { useUserColorThemeHex } from './soulnet/useUserColorThemeHex';
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
  
  const isMobile = useIsMobile();
  const themeHex = useUserColorThemeHex();
  const mountedRef = useRef<boolean>(true);

  console.log("[SoulNet] Render state:", { 
    userId, 
    timeRange, 
    hasData: graphData.nodes.length > 0,
    loading,
    dataError: !!dataError,
    canvasError: !!canvasError,
    retryCount
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Simplified data fetching effect
  useEffect(() => {
    if (!userId || !mountedRef.current) return;

    const fetchData = async () => {
      try {
        console.log("[SoulNet] Starting data fetch for userId:", userId, "timeRange:", timeRange);
        setLoading(true);
        setDataError(null);
        setCanvasError(null);
        setRetryCount(0);
        
        const startDate = getStartDate(timeRange);
        
        const { data: entries, error } = await supabase
          .from('Journal Entries')
          .select('id, entityemotion, "refined text", "transcription text"')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false });

        if (!mountedRef.current) return;

        if (error) throw error;

        console.log(`[SoulNet] Fetched ${entries?.length || 0} entries`);
        
        if (!entries || entries.length === 0) {
          console.log("[SoulNet] No entries found, setting empty data");
          setGraphData({ nodes: [], links: [] });
        } else {
          console.log("[SoulNet] Processing entries into graph data");
          const processedData = processEntities(entries);
          setGraphData(processedData);
        }
        
      } catch (error) {
        if (!mountedRef.current) return;
        console.error('[SoulNet] Data fetch error:', error);
        setDataError(error instanceof Error ? error : new Error('Unknown error'));
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchData();
  }, [userId, timeRange]);

  const handleNodeSelect = useCallback((id: string) => {
    console.log("[SoulNet] Node selected:", id);
    if (selectedNode === id) {
      setSelectedNode(null);
    } else {
      setSelectedNode(id);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }
  }, [selectedNode]);

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => {
      if (!prev) setSelectedNode(null);
      return !prev;
    });
  }, []);

  const handleCanvasError = useCallback((error: Error) => {
    console.error('[SoulNet] Canvas error:', error);
    setCanvasError(error);
    setRetryCount(prev => prev + 1);
  }, []);

  const handleRetry = useCallback(() => {
    console.log('[SoulNet] Manual retry');
    setCanvasError(null);
    setDataError(null);
    setRetryCount(0);
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div className="bg-background rounded-xl shadow-sm border w-full p-6">
        <LoadingState />
      </div>
    );
  }
  
  // Show data error
  if (dataError) {
    return (
      <div className="bg-background rounded-xl shadow-sm border w-full p-6">
        <h2 className="text-xl font-semibold text-red-600 mb-4">
          <TranslatableText text="Error Loading Soul-Net" />
        </h2>
        <p className="text-muted-foreground mb-4">{dataError.message}</p>
        <button 
          className="px-4 py-2 bg-primary text-white rounded-md" 
          onClick={handleRetry}
        >
          <TranslatableText text="Retry" />
        </button>
      </div>
    );
  }
  
  // Show empty state
  if (graphData.nodes.length === 0) {
    return <EmptyState />;
  }

  // Show persistent canvas error only after multiple retries
  if (canvasError && retryCount > 3) {
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
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
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

  // Simplified main render - always show Canvas when we have data
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
          <RenderingErrorBoundary
            onError={handleCanvasError}
            fallback={
              <div className="flex items-center justify-center p-10 bg-gray-100 dark:bg-gray-800 rounded-lg h-full">
                <div className="text-center">
                  <h3 className="text-lg font-medium">
                    <TranslatableText text="Visualization Error" />
                  </h3>
                  <p className="text-muted-foreground mt-2">
                    <TranslatableText text="Unable to render the 3D visualization." />
                  </p>
                  <button 
                    className="mt-4 px-4 py-2 bg-primary text-white rounded-lg"
                    onClick={handleRetry}
                  >
                    <TranslatableText text="Retry" />
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
              onPointerMissed={() => setSelectedNode(null)}
              gl={{ 
                preserveDrawingBuffer: true,
                antialias: !isMobile,
                powerPreference: 'high-performance',
                alpha: true,
                depth: true,
                stencil: false,
                precision: isMobile ? 'mediump' : 'highp'
              }}
              onCreated={(state) => {
                console.log('[SoulNet] Canvas created successfully');
              }}
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
        </div>
      </FullscreenWrapper>
      
      {!isFullScreen && (
        <div className="w-full text-center mt-2 px-4 md:px-8">
          <p className="text-xs text-muted-foreground">
            {getInstructions()}
          </p>
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
  
  entries.forEach(entry => {
    if (!entry.entityemotion) return;
    Object.entries(entry.entityemotion).forEach(([category, emotions]) => {
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
  });

  console.log("[SoulNet] Entity emotion map:", entityEmotionMap);
  return generateGraph(entityEmotionMap);
};

const generateGraph = (entityEmotionMap: Record<string, {emotions: Record<string, number>}>) => {
  const nodes: NodeData[] = [];
  const links: LinkData[] = [];
  const entityNodes = new Set<string>();
  const emotionNodes = new Set<string>();

  const entityList = Object.keys(entityEmotionMap);
  const EMOTION_LAYER_RADIUS = 11;
  const ENTITY_LAYER_RADIUS = 6;
  const EMOTION_Y_SPAN = 6;
  const ENTITY_Y_SPAN = 3;

  console.log("[SoulNet] Generating graph with", entityList.length, "entities");
  
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
