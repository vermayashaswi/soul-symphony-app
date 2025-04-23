import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { TimeRange } from '@/hooks/use-insights-data';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/use-theme';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeGesture } from '@/hooks/use-swipe-gesture';
import { SoulNetVisualization } from './soulnet/SoulNetVisualization';
import { useUserColorThemeHex } from './soulnet/useUserColorThemeHex';
import { useIsMobile } from '@/hooks/use-mobile';
import { Expand, Minimize } from 'lucide-react';

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
  const [entityData, setEntityData] = useState<Record<string, {emotions: Record<string, number>}>>({});
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const themeHex = useUserColorThemeHex();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const isMobile = useIsMobile();

  useSwipeGesture(containerRef, {
    onSwipeLeft: () => {},
    minDistance: 30
  });

  const getStartDate = useCallback((range: TimeRange) => {
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
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchEntityEmotionData = async () => {
      setLoading(true);
      try {
        const startDate = getStartDate(timeRange);

        const { data: entries, error } = await supabase
          .from('Journal Entries')
          .select('id, entityemotion, "refined text", "transcription text"')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching entity emotion data:', error);
          return;
        }

        if (!entries || entries.length === 0) {
          setLoading(false);
          setGraphData({ nodes: [], links: [] });
          return;
        }

        const entityEmotionMap: Record<string, {emotions: Record<string, number>}> = {};

        entries.forEach(entry => {
          if (!entry.entityemotion) return;
          Object.entries(entry.entityemotion).forEach(([category, emotions]) => {
            if (typeof emotions !== 'object') return;
            Object.entries(emotions).forEach(([emotion, score]) => {
              if (typeof score !== 'number') return;
              if (!entityEmotionMap[category]) {
                entityEmotionMap[category] = {
                  emotions: {},
                };
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

        setEntityData(entityEmotionMap);

        const generateGraph = () => {
          const nodes: NodeData[] = [];
          const links: LinkData[] = [];
          const entityNodes = new Set<string>();
          const emotionNodes = new Set<string>();
  
          const entityList = Object.keys(entityEmotionMap);
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
              color: themeHex,
              position: [emotionX, emotionY, emotionZ]
            });
          });
  
          return { nodes, links };
        };

        setGraphData(generateGraph());
      } catch (error) {
        console.error('Error processing entity-emotion data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntityEmotionData();
  }, [userId, timeRange, themeHex, getStartDate]);

  const handleCanvasClick = useCallback((e: any) => {
    if (e.target === e.currentTarget) {
      setSelectedEntity(null);
    }
  }, []);

  const handleNodeSelect = useCallback((id: string) => {
    setSelectedEntity(prevId => prevId === id ? null : id);
  }, []);

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => !prev);
  }, []);

  const canvasStyle = useMemo(() => ({
    width: '100%',
    height: '100%',
    maxWidth: '800px',
    maxHeight: '500px'
  }), []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className={`
        bg-background rounded-xl p-8 text-center border min-h-[400px] flex items-center justify-center
      `}>
        <div>
          <h2 className="text-xl font-semibold mb-4">No entity-emotion data available</h2>
          <p className="text-muted-foreground mb-6">
            Continue journaling to see the connections between entities and emotions in your life.
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      ref={containerRef}
      className={`
        relative overflow-hidden transition-all duration-300 flex justify-center items-center
        ${isFullScreen 
          ? 'fixed inset-0 z-[9999] m-0 rounded-none border-none bg-transparent' 
          : 'w-full h-[400px] rounded-xl border bg-transparent mx-2 md:mx-4 my-4'
        }
      `}
      layout
    >
      <Canvas
        style={canvasStyle}
        onClick={handleCanvasClick}
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
      
      <button
        onClick={toggleFullScreen}
        className="absolute top-4 right-4 z-[10000] p-2 rounded-lg bg-background/80 backdrop-blur-sm shadow-lg"
        aria-label={isFullScreen ? "Minimize" : "Expand to fullscreen"}
      >
        {isFullScreen ? (
          <Minimize className="w-5 h-5 text-foreground" />
        ) : (
          <Expand className="w-5 h-5 text-foreground" />
        )}
      </button>

      <div className="w-full text-center mt-2 px-4">
        <p className="text-xs text-muted-foreground">
          <b>Drag</b> to rotate • <b>Scroll</b> to zoom • <b>Tap/Click</b> a node to highlight connections
        </p>
      </div>
    </motion.div>
  );
};

export default SoulNet;
