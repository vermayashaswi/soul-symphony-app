
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

interface SoulNetProps {
  userId: string | undefined;
  timeRange: TimeRange;
}

const SoulNet: React.FC<SoulNetProps> = ({ userId, timeRange }) => {
  const [graphData, setGraphData] = useState<{nodes: NodeData[], links: LinkData[]}>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [canvasError, setCanvasError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [canvasReady, setCanvasReady] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [initializationStage, setInitializationStage] = useState<'idle' | 'data-loading' | 'data-processing' | 'canvas-preparing' | 'ready'>('idle');
  
  const isMobile = useIsMobile();
  const themeHex = useUserColorThemeHex();
  const { currentLanguage } = useTranslation();
  const initializationRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  console.log("[SoulNet] Enhanced initialization management", { 
    userId, 
    timeRange, 
    currentLanguage,
    canvasReady,
    hasData: graphData.nodes.length > 0,
    initializationStage,
    retryCount
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Enhanced canvas readiness with proper state management
  useEffect(() => {
    if (graphData.nodes.length > 0 && !canvasReady && initializationStage !== 'ready') {
      console.log("[SoulNet] Preparing canvas with enhanced safety");
      setInitializationStage('canvas-preparing');
      
      const readyTimer = setTimeout(() => {
        if (mountedRef.current) {
          setCanvasReady(true);
          setInitializationStage('ready');
          console.log("[SoulNet] Canvas ready with enhanced initialization");
        }
      }, 200);
      
      return () => clearTimeout(readyTimer);
    }
  }, [graphData.nodes.length, canvasReady, initializationStage]);

  // Enhanced data fetching with proper error handling and state management
  useEffect(() => {
    if (!userId || !mountedRef.current) return;

    const fetchEntityEmotionData = async () => {
      try {
        setLoading(true);
        setError(null);
        setCanvasError(null);
        setInitializationStage('data-loading');
        initializationRef.current = false;
        
        const startDate = getStartDate(timeRange);
        console.log(`[SoulNet] Enhanced data fetch from ${startDate.toISOString()} for user ${userId}`);
        
        const { data: entries, error } = await supabase
          .from('Journal Entries')
          .select('id, entityemotion, "refined text", "transcription text"')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false });

        if (!mountedRef.current) return;

        if (error) {
          console.error('[SoulNet] Error fetching journal entries:', error);
          throw error;
        }

        console.log(`[SoulNet] Enhanced fetch completed: ${entries?.length || 0} entries`);
        
        if (!entries || entries.length === 0) {
          setLoading(false);
          setGraphData({ nodes: [], links: [] });
          setInitializationStage('ready');
          return;
        }

        setInitializationStage('data-processing');
        
        // Process data with safety checks
        const processedData = processEntities(entries);
        
        if (!mountedRef.current) return;
        
        console.log("[SoulNet] Enhanced data processing completed", {
          nodes: processedData.nodes.length,
          links: processedData.links.length
        });
        
        setGraphData(processedData);
        initializationRef.current = true;
        
      } catch (error) {
        if (!mountedRef.current) return;
        
        console.error('[SoulNet] Enhanced error handling:', error);
        setError(error instanceof Error ? error : new Error('Unknown error occurred'));
        setInitializationStage('idle');
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchEntityEmotionData();
  }, [userId, timeRange]);

  const handleNodeSelect = useCallback((id: string) => {
    console.log(`[SoulNet] Enhanced node selection: ${id}`);
    if (selectedEntity === id) {
      setSelectedEntity(null);
    } else {
      setSelectedEntity(id);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }
  }, [selectedEntity]);

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => {
      if (!prev) setSelectedEntity(null);
      console.log(`[SoulNet] Enhanced fullscreen toggle: ${!prev}`);
      return !prev;
    });
  }, []);

  const handleCanvasError = useCallback((error: Error) => {
    console.error('[SoulNet] Enhanced canvas error handling:', error);
    setCanvasError(error);
    setRetryCount(prev => prev + 1);
    setCanvasReady(false);
    setInitializationStage('idle');
  }, []);

  const handleRetry = useCallback(() => {
    console.log('[SoulNet] Enhanced manual retry initiated');
    setCanvasError(null);
    setError(null);
    setRetryCount(0);
    setCanvasReady(false);
    setInitializationStage('idle');
    initializationRef.current = false;
    
    // Reset canvas readiness after a brief delay
    setTimeout(() => {
      if (graphData.nodes.length > 0 && mountedRef.current) {
        setInitializationStage('canvas-preparing');
      }
    }, 300);
  }, [graphData.nodes.length]);

  // Enhanced loading state with stage information
  if (loading) {
    return (
      <div className="bg-background rounded-xl shadow-sm border w-full p-6">
        <LoadingState />
        <div className="text-center mt-2">
          <p className="text-sm text-muted-foreground">
            {initializationStage === 'data-loading' && 'Loading journal data...'}
            {initializationStage === 'data-processing' && 'Processing insights...'}
            {initializationStage === 'canvas-preparing' && 'Preparing visualization...'}
          </p>
        </div>
      </div>
    );
  }
  
  if (error) return (
    <div className="bg-background rounded-xl shadow-sm border w-full p-6">
      <h2 className="text-xl font-semibold text-red-600 mb-4">
        <TranslatableText text="Error Loading Soul-Net" />
      </h2>
      <p className="text-muted-foreground mb-4">{error.message}</p>
      <button 
        className="px-4 py-2 bg-primary text-white rounded-md" 
        onClick={handleRetry}
      >
        <TranslatableText text="Retry" />
      </button>
    </div>
  );
  
  if (graphData.nodes.length === 0) return <EmptyState />;

  // Enhanced error handling for persistent canvas errors
  if (canvasError && retryCount > 2) {
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
          <div className="space-x-2">
            <button
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              onClick={handleRetry}
            >
              <TranslatableText text="Try Again" />
            </button>
          </div>
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

  console.log(`[SoulNet] Enhanced render with canvas ready: ${canvasReady}, stage: ${initializationStage}, nodes: ${graphData.nodes.length}`);

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
        <RenderingErrorBoundary
          onError={handleCanvasError}
          fallback={
            <div className="flex items-center justify-center p-10 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <div className="text-center">
                <h3 className="text-lg font-medium">
                  <TranslatableText text="Visualization Loading" />
                </h3>
                <p className="text-muted-foreground mt-2">
                  <TranslatableText text="Preparing the visualization..." />
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
          <div className="relative">
            {canvasReady && initializationStage === 'ready' && (
              <Canvas
                style={{
                  width: '100%',
                  height: '100%',
                  maxWidth: isFullScreen ? 'none' : '800px',
                  maxHeight: isFullScreen ? 'none' : '500px',
                  position: 'relative',
                  zIndex: 5,
                  transition: 'all 0.3s ease-in-out',
                }}
                camera={{ 
                  position: [0, 0, isFullScreen ? 40 : 45],
                  near: 1, 
                  far: 1000,
                  fov: isFullScreen ? 60 : 50
                }}
                onPointerMissed={() => setSelectedEntity(null)}
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
                  console.log('[SoulNet] Canvas created successfully', state);
                }}
                onError={(error) => {
                  console.error('[SoulNet] Canvas creation error:', error);
                  handleCanvasError(error);
                }}
              >
                <SimplifiedSoulNetVisualization
                  data={graphData}
                  selectedNode={selectedEntity}
                  onNodeClick={handleNodeSelect}
                  themeHex={themeHex}
                  isFullScreen={isFullScreen}
                  shouldShowLabels={true}
                />
              </Canvas>
            )}
            
            {(!canvasReady || initializationStage !== 'ready') && (
              <div className="flex items-center justify-center" style={{ height: '500px' }}>
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">
                    {initializationStage === 'canvas-preparing' ? 'Preparing visualization...' : 'Loading...'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </RenderingErrorBoundary>
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
