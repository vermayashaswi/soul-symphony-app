
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import '@/types/three-reference';
import { Canvas } from '@react-three/fiber';
import { TimeRange } from '@/hooks/use-insights-data';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import SoulNetVisualization from './soulnet/SoulNetVisualization';
import { LoadingState } from './soulnet/LoadingState';
import { EmptyState } from './soulnet/EmptyState';
import { FullscreenWrapper } from './soulnet/FullscreenWrapper';
import SoulNetDescription from './soulnet/SoulNetDescription';
import { useUserColorThemeHex } from './soulnet/useUserColorThemeHex';
import { HTMLLabelOverlay } from './soulnet/HTMLLabelOverlay';
import { cn } from '@/lib/utils';
import ErrorBoundary from './ErrorBoundary';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { onDemandTranslationCache } from '@/utils/website-translations';

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
  const isMobile = useIsMobile();
  const themeHex = useUserColorThemeHex();
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const { currentLanguage } = useTranslation();
  const [renderError, setRenderError] = useState<string | null>(null);

  console.log("Rendering SoulNet component with userId:", userId, "and timeRange:", timeRange);

  useEffect(() => {
    console.log("SoulNet mounted");
    return () => {
      console.log("SoulNet unmounted");
    };
  }, []);

  // Reset translation cache when language changes to avoid stale translations
  useEffect(() => {
    try {
      onDemandTranslationCache.clearLanguage(currentLanguage);
    } catch (error) {
      console.warn('Translation cache clear error:', error);
    }
  }, [currentLanguage]);

  // Data fetching with enhanced error handling
  useEffect(() => {
    if (!userId) return;

    const fetchEntityEmotionData = async () => {
      setLoading(true);
      setError(null);
      setRenderError(null);
      
      try {
        const startDate = getStartDate(timeRange);
        console.log(`Fetching data from ${startDate.toISOString()} for user ${userId}`);
        
        const { data: entries, error } = await supabase
          .from('Journal Entries')
          .select('id, entityemotion, "refined text", "transcription text"')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching journal entries:', error);
          throw error;
        }

        console.log(`Fetched ${entries?.length || 0} entries`);
        
        if (!entries || entries.length === 0) {
          setLoading(false);
          setGraphData({ nodes: [], links: [] });
          return;
        }

        const processedData = processEntities(entries);
        console.log("Processed graph data:", processedData);
        
        // Validate processed data
        if (!processedData || !Array.isArray(processedData.nodes) || !Array.isArray(processedData.links)) {
          throw new Error('Invalid processed data structure');
        }
        
        setGraphData(processedData);
      } catch (error) {
        console.error('Error processing entity-emotion data:', error);
        setError(error instanceof Error ? error : new Error('Unknown error occurred'));
      } finally {
        setLoading(false);
      }
    };

    fetchEntityEmotionData();
  }, [userId, timeRange]);

  const handleNodeSelect = useCallback((id: string) => {
    try {
      console.log(`Node selected: ${id}`);
      if (selectedEntity === id) {
        setSelectedEntity(null);
      } else {
        setSelectedEntity(id);
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
    } catch (error) {
      console.error('Node selection error:', error);
    }
  }, [selectedEntity]);

  const toggleFullScreen = useCallback(() => {
    try {
      setIsFullScreen(prev => {
        // Force clear selected node when toggling fullscreen to reset view
        if (!prev) setSelectedEntity(null);
        return !prev;
      });
    } catch (error) {
      console.error('Fullscreen toggle error:', error);
    }
  }, []);

  // Safe labels generation with validation
  const generateLabelsData = useCallback(() => {
    try {
      if (!graphData.nodes.length) return [];

      return graphData.nodes
        .filter(node => node && typeof node.id === 'string' && node.id.length > 0)
        .map(node => {
          const isHighlighted = selectedEntity !== null && (
            selectedEntity === node.id ||
            graphData.links.some(link => 
              (link.source === selectedEntity && link.target === node.id) ||
              (link.target === selectedEntity && link.source === node.id)
            )
          );

          const isSelected = selectedEntity === node.id;
          const shouldShow = isFullScreen || isSelected || isHighlighted;

          return {
            id: node.id,
            text: node.id,
            position: node.position as [number, number, number],
            isVisible: shouldShow,
            isHighlighted,
            isSelected,
            nodeType: node.type,
            color: node.type === 'entity' ? '#ffffff' : themeHex
          };
        });
    } catch (error) {
      console.error('Labels generation error:', error);
      return [];
    }
  }, [graphData, selectedEntity, isFullScreen, themeHex]);

  // Memoized labels to prevent unnecessary re-renders
  const labelsData = useMemo(() => generateLabelsData(), [generateLabelsData]);

  // Canvas error handler
  const handleCanvasError = useCallback((error: Error) => {
    console.error('Canvas rendering error:', error);
    setRenderError(error.message);
  }, []);

  if (loading) return <LoadingState />;
  
  if (error) return (
    <div className="bg-background rounded-xl shadow-sm border w-full p-6">
      <h2 className="text-xl font-semibold text-red-600 mb-4">
        <TranslatableText text="Error Loading Soul-Net" />
      </h2>
      <p className="text-muted-foreground mb-4">{error.message}</p>
      <button 
        className="px-4 py-2 bg-primary text-white rounded-md" 
        onClick={() => window.location.reload()}
      >
        <TranslatableText text="Retry" />
      </button>
    </div>
  );

  if (renderError) return (
    <div className="bg-background rounded-xl shadow-sm border w-full p-6">
      <h2 className="text-xl font-semibold text-orange-600 mb-4">
        <TranslatableText text="Rendering Error" />
      </h2>
      <p className="text-muted-foreground mb-4">
        <TranslatableText text="There was an issue rendering the 3D visualization. This may be due to your device's graphics capabilities." />
      </p>
      <div className="space-x-2">
        <button 
          className="px-4 py-2 bg-primary text-white rounded-md" 
          onClick={() => setRenderError(null)}
        >
          <TranslatableText text="Try Again" />
        </button>
        <button 
          className="px-4 py-2 bg-gray-500 text-white rounded-md" 
          onClick={() => window.location.reload()}
        >
          <TranslatableText text="Reload Page" />
        </button>
      </div>
    </div>
  );
  
  if (graphData.nodes.length === 0) return <EmptyState />;

  // Get appropriate instructions based on device type
  const getInstructions = () => {
    if (isMobile) {
      return <TranslatableText text="Drag to rotate • Pinch to zoom • Tap a node to highlight connections" forceTranslate={true} />;
    }
    return <TranslatableText text="Drag to rotate • Scroll to zoom • Click a node to highlight connections" forceTranslate={true} />;
  };

  return (
    <div className={cn(
      "bg-background rounded-xl shadow-sm border w-full",
      isMobile ? "p-0" : "p-6 md:p-8"
    )}>
      {!isFullScreen && <SoulNetDescription />}
      
      <FullscreenWrapper
        isFullScreen={isFullScreen}
        toggleFullScreen={toggleFullScreen}
      >
        <ErrorBoundary 
          onError={handleCanvasError}
          fallback={
            <div className="flex items-center justify-center p-10 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <div className="text-center">
                <h3 className="text-lg font-medium">
                  <TranslatableText text="Error in Soul-Net Visualization" forceTranslate={true} />
                </h3>
                <p className="text-muted-foreground mt-2">
                  <TranslatableText text="There was a problem rendering the visualization." forceTranslate={true} />
                </p>
                <button 
                  className="mt-4 px-4 py-2 bg-primary text-white rounded-lg"
                  onClick={() => setRenderError(null)}
                >
                  <TranslatableText text="Reload" forceTranslate={true} />
                </button>
              </div>
            </div>
          }
        >
          <div className="relative">
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
                powerPreference: isMobile ? 'low-power' : 'high-performance',
                alpha: true,
                depth: true,
                stencil: false,
                precision: isMobile ? 'mediump' : 'highp',
                logarithmicDepthBuffer: false, // Disable for better compatibility
                failIfMajorPerformanceCaveat: false // Don't fail on slow devices
              }}
              onCreated={({ gl }) => {
                // Additional WebGL optimizations
                gl.debug.checkShaderErrors = false;
                gl.capabilities.isWebGL2 = false; // Force WebGL1 for compatibility
              }}
              onError={handleCanvasError}
            >
              <SoulNetVisualization
                data={graphData}
                selectedNode={selectedEntity}
                onNodeClick={handleNodeSelect}
                themeHex={themeHex}
                isFullScreen={isFullScreen}
                shouldShowLabels={false} // Disable 3D labels, use HTML overlay instead
              />
            </Canvas>
            
            <HTMLLabelOverlay labels={labelsData} />
          </div>
        </ErrorBoundary>
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
  console.log("Processing entities for", entries.length, "entries");
  
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

  console.log("Entity emotion map:", entityEmotionMap);
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

  console.log("Generating graph with", entityList.length, "entities");
  
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

  console.log("Generated graph with", nodes.length, "nodes and", links.length, "links");
  return { nodes, links };
};

export default SoulNet;
