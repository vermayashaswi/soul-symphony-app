import React, { useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { TimeRange } from '@/hooks/use-insights-data';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/use-theme';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeGesture } from '@/hooks/use-swipe-gesture';
import { SoulNetVisualization } from './soulnet/SoulNetVisualization';
import { EntityInfoPanel } from './soulnet/EntityInfoPanel';
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

  useEffect(() => {
    if (!userId) return;

    const fetchEntityEmotionData = async () => {
      setLoading(true);
      try {
        const now = new Date();
        let startDate;
        switch (timeRange) {
          case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case 'week':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 7);
            break;
          case 'month':
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 1);
            break;
          case 'year':
            startDate = new Date(now);
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
          default:
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 7);
        }

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

        setGraphData({ nodes, links });
      } catch (error) {
        console.error('Error processing entity-emotion data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntityEmotionData();
  }, [userId, timeRange, themeHex]);

  const handleCanvasClick = (e: any) => {
    if (e.target === e.currentTarget) {
      setSelectedEntity(null);
    }
  };

  const handleNodeSelect = (id: string) => {
    setSelectedEntity(prevId => prevId === id ? null : id);
  };

  const toggleFullScreen = () => {
    setIsFullScreen(prev => !prev);
  };

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
      className={`relative rounded-xl overflow-hidden border touch-action-none transition-all duration-300 ${
        isFullScreen 
          ? 'fixed inset-0 z-50 m-0 rounded-none border-none'
          : 'w-full h-[600px]'
      }`}
      layout
    >
      <Canvas
        onClick={handleCanvasClick}
        camera={{ position: [0, 0, 26] }}
        onPointerMissed={() => setSelectedEntity(null)}
        gl={{ preserveDrawingBuffer: true }}
      >
        <SoulNetVisualization
          data={graphData}
          selectedNode={selectedEntity}
          onNodeClick={handleNodeSelect}
          themeHex={themeHex}
        />
      </Canvas>
      
      {isMobile && (
        <button
          onClick={toggleFullScreen}
          className="absolute top-4 right-16 z-50 p-2 rounded-lg bg-background/80 backdrop-blur-sm shadow-lg"
        >
          {isFullScreen ? (
            <Minimize className="w-5 h-5 text-foreground" />
          ) : (
            <Expand className="w-5 h-5 text-foreground" />
          )}
        </button>
      )}

      <div className="absolute bottom-4 left-4 p-3 rounded-lg bg-background/80 backdrop-blur-sm">
        <p className="text-xs text-muted-foreground">
          <b>Drag</b> to rotate • <b>Scroll</b> to zoom • <b>Tap/Click</b> a node to highlight connections
        </p>
      </div>
      
      {selectedEntity && (
        <EntityInfoPanel
          selectedEntity={selectedEntity}
          entityData={entityData}
        />
      )}
    </motion.div>
  );
};

export default SoulNet;
