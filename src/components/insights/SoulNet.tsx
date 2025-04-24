
import React, { useState, useEffect, useCallback } from 'react';
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
import { cn } from '@/lib/utils';
import ErrorBoundary from './ErrorBoundary';

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

  console.log("Rendering SoulNet component with userId:", userId, "and timeRange:", timeRange);

  useEffect(() => {
    console.log("SoulNet mounted");
    return () => {
      console.log("SoulNet unmounted");
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchEntityEmotionData = async () => {
      setLoading(true);
      setError(null);
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
    console.log(`Node selected: ${id}`);
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
    setIsFullScreen(prev => !prev);
  }, []);

  if (loading) return <LoadingState />;
  if (error) return (
    <div className="bg-background rounded-xl shadow-sm border w-full p-6">
      <h2 className="text-xl font-semibold text-red-600 mb-4">Error Loading SoulNet</h2>
      <p className="text-muted-foreground mb-4">{error.message}</p>
      <button 
        className="px-4 py-2 bg-primary text-white rounded-md" 
        onClick={() => window.location.reload()}
      >
        Retry
      </button>
    </div>
  );
  if (graphData.nodes.length === 0) return <EmptyState />;

  return (
    <div className={cn(
      "bg-background rounded-xl shadow-sm border w-full",
      isMobile ? "p-0" : "p-6 md:p-8"
    )}>
      <SoulNetDescription />
      
      <FullscreenWrapper
        isFullScreen={isFullScreen}
        toggleFullScreen={toggleFullScreen}
      >
        <ErrorBoundary fallback={
          <div className="flex items-center justify-center p-10 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="text-center">
              <h3 className="text-lg font-medium">Error in SoulNet Visualization</h3>
              <p className="text-muted-foreground mt-2">
                There was a problem rendering the visualization.
              </p>
              <button 
                className="mt-4 px-4 py-2 bg-primary text-white rounded-lg"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
          </div>
        }>
          <Canvas
            style={{
              width: '100%',
              height: '100%',
              maxWidth: '800px',
              maxHeight: '500px'
            }}
            camera={{ position: [0, 0, 26] }}
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
          >
            <SoulNetVisualization
              data={graphData}
              selectedNode={selectedEntity}
              onNodeClick={handleNodeSelect}
              themeHex={themeHex}
            />
          </Canvas>
        </ErrorBoundary>
      </FullscreenWrapper>
      
      <div className="w-full text-center mt-2 px-4 md:px-8">
        <p className="text-xs text-muted-foreground">
          <b>Drag</b> to rotate • <b>Scroll</b> to zoom • <b>Tap/Click</b> a node to highlight connections
        </p>
      </div>
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
