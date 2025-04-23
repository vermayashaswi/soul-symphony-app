import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useTheme } from '@/hooks/use-theme';
import { motion } from 'framer-motion';
import { TimeRange } from '@/hooks/use-insights-data';
import { supabase } from '@/integrations/supabase/client';
import { useSwipeGesture } from '@/hooks/use-swipe-gesture';

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

const colorMap: Record<string, string> = {
  joy: '#4CAF50',
  love: '#E91E63',
  anger: '#F44336',
  fear: '#FF9800',
  sadness: '#2196F3',
  surprise: '#9C27B0',
  disgust: '#795548',
  trust: '#00BCD4',
  anticipation: '#FFEB3B',
  calm: '#8BC34A',
  anxiety: '#FFC107',
  stress: '#FF5722',
  guilt: '#607D8B',
  shame: '#9E9E9E',
  pride: '#CDDC39',
  gratitude: '#3F51B5',
  hope: '#03A9F4',
  confusion: '#673AB7',
  amazement: '#009688',
  curiosity: '#2196F3',
};

const getEmotionColor = (_emotion: string, themeHex: string): string => {
  return themeHex || '#9C27B0';
};

function getConnectedNodes(nodeId: string, links: LinkData[]): Set<string> {
  const connected = new Set<string>();
  links.forEach(link => {
    if (link.source === nodeId) connected.add(link.target);
    if (link.target === nodeId) connected.add(link.source);
  });
  return connected;
}

const Node: React.FC<{
  node: NodeData; 
  isSelected: boolean;
  onClick: (id: string) => void;
  highlightedNodes: Set<string>;
  showLabel: boolean;
  dimmed: boolean;
  themeHex: string;
  selectedNodeId: string | null;
}> = ({ node, isSelected, onClick, highlightedNodes, showLabel, dimmed, themeHex, selectedNodeId }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { theme } = useTheme();
  const isHighlighted = isSelected || highlightedNodes.has(node.id);
  const baseScale = node.type === 'entity' ? 0.5 : 0.4;
  const scale = baseScale * (0.8 + node.value * 0.5);

  let displayColor = node.type === 'entity'
    ? (dimmed ? (theme === 'dark' ? '#8E9196' : '#bbb') : '#fff')
    : (dimmed
        ? (theme === 'dark' ? '#8E9196' : '#bbb')
        : themeHex);

  const Geometry = node.type === 'entity' 
    ? <sphereGeometry args={[1, 32, 32]} /> 
    : <boxGeometry args={[1.2, 1.2, 1.2]} />;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (isHighlighted && !dimmed) {
      const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.1 + 1;
      meshRef.current.scale.set(scale * pulse, scale * pulse, scale * pulse);
      if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
        meshRef.current.material.emissiveIntensity = 0.5 + Math.sin(clock.getElapsedTime() * 5) * 0.2;
      }
    } else {
      meshRef.current.scale.set(scale, scale, scale);
      if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
        meshRef.current.material.emissiveIntensity = 0;
      }
    }
  });

  const shouldShowLabel = 
    !selectedNodeId || 
    node.id === selectedNodeId || 
    highlightedNodes.has(node.id);

  return (
    <group position={node.position}>
      <mesh 
        ref={meshRef} 
        scale={[scale, scale, scale]}
        onClick={(e) => {
          e.stopPropagation();
          onClick(node.id);
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onClick(node.id);
        }}
      >
        {Geometry}
        <meshStandardMaterial 
          color={displayColor}
          transparent
          opacity={isHighlighted ? 1 : 0.7}
          emissive={displayColor}
          emissiveIntensity={isHighlighted && !dimmed ? 0.5 : 0}
        />
      </mesh>
      {shouldShowLabel && (
        <Html
          position={[0, node.type === 'entity' ? 1.2 : 1.4, 0]}
          center
          distanceFactor={15}
          occlude
        >
          <div className={`
            px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap
            ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}
            ${isHighlighted ? 'scale-110 font-bold' : 'opacity-90'}
            shadow transition-all duration-200
          `}>
            {node.id}
          </div>
        </Html>
      )}
    </group>
  );
};

const Edge: React.FC<{
  start: [number, number, number]; 
  end: [number, number, number];
  value: number;
  isHighlighted: boolean;
  dimmed: boolean;
}> = ({ start, end, value, isHighlighted, dimmed }) => {
  const ref = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.LineSegments>(null);

  const points = useMemo(() => {
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);
    const midPoint = startVec.clone().add(endVec).multiplyScalar(0.5);
    const midOffset = 0.5;
    midPoint.y += midOffset;
    const curve = new THREE.QuadraticBezierCurve3(
      startVec,
      midPoint,
      endVec
    );
    return curve.getPoints(20);
  }, [start, end]);

  useFrame(({ clock }) => {
    if (!lineRef.current || !lineRef.current.material) return;
    if (isHighlighted && !dimmed) {
      const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.3 + 0.7;
      if (lineRef.current.material instanceof THREE.LineBasicMaterial) {
        lineRef.current.material.opacity = 0.5 + value * 0.5 * pulse;
      }
    } else {
      if (lineRef.current.material instanceof THREE.LineBasicMaterial) {
        lineRef.current.material.opacity = dimmed ? 0.06 : (0.18 + value * 0.13);
      }
    }
  });

  const thickness = 1 + value * 4;

  return (
    <group ref={ref}>
      <primitive object={new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: dimmed ? '#BBB' : (isHighlighted ? "#ffffff" : "#aaaaaa"),
          transparent: true,
          opacity: dimmed ? 0.06 : (isHighlighted ? 0.8 : 0.3),
          linewidth: thickness
        })
      )} ref={lineRef} />
    </group>
  );
};

const SoulNetVisualization: React.FC<{
  data: { nodes: NodeData[]; links: LinkData[] };
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
  themeHex: string;
}> = ({ data, selectedNode, onNodeClick, themeHex }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (camera) {
      camera.position.set(0, 0, 26);
      camera.lookAt(0, 0, 0);
    }
  }, [camera]);

  const highlightedNodes = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    return getConnectedNodes(selectedNode, data.links);
  }, [selectedNode, data.links]);

  const shouldDim = !!selectedNode;

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <OrbitControls 
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        minDistance={5}
        maxDistance={30}
        target={[0, 0, 0]}
      />
      {data.links.map((link, index) => {
        const sourceNode = data.nodes.find(n => n.id === link.source);
        const targetNode = data.nodes.find(n => n.id === link.target);
        if (!sourceNode || !targetNode) return null;
        const isHighlight = selectedNode &&
          (link.source === selectedNode || link.target === selectedNode);
        const dimmedStatus = shouldDim && !isHighlight
          && !(highlightedNodes.has(link.source) && highlightedNodes.has(link.target));

        return (
          <Edge
            key={`edge-${index}`}
            start={sourceNode.position}
            end={targetNode.position}
            value={link.value}
            isHighlighted={!!isHighlight}
            dimmed={shouldDim && !isHighlight}
          />
        );
      })}
      {data.nodes.map(node => {
        const showLabel = true;
        
        const dimmed = shouldDim && !(selectedNode === node.id || highlightedNodes.has(node.id));
        
        return (
          <Node
            key={`node-${node.id}`}
            node={node}
            isSelected={selectedNode === node.id}
            onClick={onNodeClick}
            highlightedNodes={highlightedNodes}
            showLabel={showLabel}
            dimmed={dimmed}
            themeHex={themeHex}
            selectedNodeId={selectedNode}
          />
        );
      })}
    </>
  );
};

const EntityInfoPanel: React.FC<{
  selectedEntity: string | null;
  entityData: Record<string, {emotions: Record<string, number>, entries?: Array<{id: number, content: string}>}>;
}> = ({ selectedEntity, entityData }) => {
  const { theme } = useTheme();
  if (!selectedEntity || !entityData[selectedEntity]) return null;
  const entityInfo = entityData[selectedEntity];
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`
        absolute top-4 right-4 p-3 rounded-lg shadow-lg max-w-[250px] max-h-[40vh] overflow-y-auto
        ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}
      `}
    >
      <h3 className="text-lg font-bold mb-2 pb-2 border-b">{selectedEntity}</h3>
      <h4 className="text-sm font-semibold mt-2 mb-1">Top Emotions</h4>
      <div className="space-y-1">
        {Object.entries(entityInfo.emotions)
          .sort(([, a], [, b]) => b - a)
          .map(([emotion, score]) => (
            <div key={emotion} className="flex items-center justify-between">
              <span className="text-sm">{emotion}</span>
              <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                <div 
                  className="h-full" 
                  style={{ 
                    width: `${Math.min(score * 100, 100)}%`,
                    backgroundColor: theme === 'dark' ? '#8b5cf6' : '#8b5cf6'
                  }}
                />
              </div>
            </div>
          ))}
      </div>
    </motion.div>
  );
};

function useUserColorThemeHex() {
  const { colorTheme, customColor } = useTheme();
  switch (colorTheme) {
    case 'Default':
      return '#3b82f6';
    case 'Calm':
      return '#8b5cf6';
    case 'Soothing':
      return '#FFDEE2';
    case 'Energy':
      return '#f59e0b';
    case 'Focus':
      return '#10b981';
    case 'Custom':
      return customColor || '#3b82f6';
    default:
      return '#3b82f6';
  }
}

const SoulNet: React.FC<SoulNetProps> = ({ userId, timeRange }) => {
  const [graphData, setGraphData] = useState<{nodes: NodeData[], links: LinkData[]}>({ nodes: [], links: [] });
  const [entityData, setEntityData] = useState<Record<string, {emotions: Record<string, number>, entries?: Array<{id: number, content: string}>}>>({});
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const themeHex = useUserColorThemeHex();

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

        const entityEmotionMap: Record<string, {emotions: Record<string, number>, entries: Array<{id: number, content: string}>}> = {};

        entries.forEach(entry => {
          if (!entry.entityemotion) return;
          const content = entry["refined text"] || entry["transcription text"] || "";
          Object.entries(entry.entityemotion).forEach(([category, emotions]) => {
            if (typeof emotions !== 'object') return;
            Object.entries(emotions).forEach(([emotion, score]) => {
              if (typeof score !== 'number') return;
              if (!entityEmotionMap[category]) {
                entityEmotionMap[category] = { 
                  emotions: {},
                  entries: []
                };
              }
              if (entityEmotionMap[category].emotions[emotion]) {
                entityEmotionMap[category].emotions[emotion] = 
                  (entityEmotionMap[category].emotions[emotion] + score) / 2;
              } else {
                entityEmotionMap[category].emotions[emotion] = score;
              }
              if (content) {
                entityEmotionMap[category].entries.push({
                  id: entry.id,
                  content
                });
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
    <div 
      ref={containerRef}
      className="relative w-full h-[600px] rounded-xl overflow-hidden border touch-action-none"
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
    </div>
  );
};

export default SoulNet;
