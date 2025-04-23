import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useTheme } from '@/hooks/use-theme';
import { motion } from 'framer-motion';
import { TimeRange } from '@/hooks/use-insights-data';
import { supabase } from '@/integrations/supabase/client';

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

const greyColor = "#B0B3B8"; // neutral grey for faded nodes

const colorMap: Record<string, string> = {
  joy: '#4CAF50',      // Green
  love: '#E91E63',     // Pink
  anger: '#F44336',    // Red
  fear: '#FF9800',     // Orange
  sadness: '#2196F3',  // Blue
  surprise: '#9C27B0', // Purple
  disgust: '#795548',  // Brown
  trust: '#00BCD4',    // Cyan
  anticipation: '#FFEB3B', // Yellow
  calm: '#8BC34A',     // Light Green
  anxiety: '#FFC107',  // Amber
  stress: '#FF5722',   // Deep Orange
  guilt: '#607D8B',    // Blue Gray
  shame: '#9E9E9E',    // Gray
  pride: '#CDDC39',    // Lime
  gratitude: '#3F51B5', // Indigo
  hope: '#03A9F4',     // Light Blue
  confusion: '#673AB7', // Deep Purple
  amazement: '#009688', // Teal
  curiosity: '#2196F3', // Light Blue
};

const getEmotionColor = (emotion: string): string => {
  const lowerEmotion = emotion.toLowerCase();
  return colorMap[lowerEmotion] || '#9C27B0'; // Default to purple if not found
};

const Node: React.FC<{
  node: NodeData; 
  isSelected: boolean;
  isRelevant: boolean;
  onClick: (id: string) => void;
  showLabel: boolean;
  labelBig: boolean;
}> = ({ node, isSelected, isRelevant, onClick, showLabel, labelBig }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { theme } = useTheme();
  const baseScale = node.type === 'entity' ? 0.5 : 0.4;
  const scale = baseScale * (0.8 + node.value * 0.5);
  const color = isRelevant ? node.color : greyColor;
  const labelScaleClass = labelBig ? "scale-125 font-bold" : "";

  const Geometry = node.type === 'entity' 
    ? <sphereGeometry args={[1, 32, 32]} /> 
    : <boxGeometry args={[1.2, 1.2, 1.2]} />;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (isRelevant) {
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

  return (
    <group position={node.position}>
      <mesh 
        ref={meshRef} 
        scale={[scale, scale, scale]}
        onClick={(e) => {
          e.stopPropagation();
          onClick(node.id);
        }}
      >
        {Geometry}
        <meshStandardMaterial 
          color={color}
          transparent
          opacity={isRelevant ? 1 : 0.7}
          emissive={isRelevant ? node.color : "#222"}
          emissiveIntensity={isRelevant ? 0.5 : 0}
        />
      </mesh>
      {showLabel && (
        <Html
          position={[0, node.type === 'entity' ? 1.2 : 1.4, 0]}
          center
          distanceFactor={15}
          occlude
        >
          <div className={`
            px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap
            ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}
            ${labelScaleClass}
            transform transition-all duration-200
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
}> = ({ start, end, value, isHighlighted }) => {
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
    
    if (isHighlighted) {
      const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.3 + 0.7;
      if (lineRef.current.material instanceof THREE.LineBasicMaterial) {
        lineRef.current.material.opacity = 0.5 + value * 0.5 * pulse;
      }
    } else {
      if (lineRef.current.material instanceof THREE.LineBasicMaterial) {
        lineRef.current.material.opacity = 0.1 + value * 0.2;
      }
    }
  });
  
  const thickness = 1 + value * 4;
  
  return (
    <group ref={ref}>
      <primitive object={new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: isHighlighted ? "#ffffff" : "#aaaaaa",
          transparent: true,
          opacity: isHighlighted ? 0.8 : 0.2,
          linewidth: thickness
        })
      )} ref={lineRef} />
    </group>
  );
};

const SoulNetVisualization: React.FC<{
  data: { nodes: NodeData[]; links: LinkData[] };
  onNodeSelect: (id: string) => void;
  selectedNode: string | null;
}> = ({ data, onNodeSelect, selectedNode }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const connectedNodes = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    data.links.forEach(link => {
      if (!map[link.source]) map[link.source] = new Set();
      if (!map[link.target]) map[link.target] = new Set();
      map[link.source].add(link.target);
      map[link.target].add(link.source);
    });
    return map;
  }, [data.links]);

  const relevantNodes = useMemo(() => {
    if (!selectedNode) return new Set(data.nodes.map(n => n.id));
    const set = new Set<string>();
    set.add(selectedNode);
    (connectedNodes[selectedNode] || []).forEach(id => set.add(id));
    return set;
  }, [selectedNode, connectedNodes, data.nodes]);

  const relevantLinks = useMemo(() => {
    if (!selectedNode) return new Set(data.links.map(l => `${l.source}-${l.target}`));
    return new Set(data.links
      .filter(l => l.source === selectedNode || l.target === selectedNode)
      .map(l => `${l.source}-${l.target}`));
  }, [selectedNode, data.links]);

  const handleNodeClick = (id: string) => {
    onNodeSelect(id);
    const node = data.nodes.find(n => n.id === id);
    if (node && controlsRef.current) {
      controlsRef.current.target.set(...node.position);
    }
  };

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
      />
      {data.links.map((link, index) => {
        const sourceNode = data.nodes.find(n => n.id === link.source);
        const targetNode = data.nodes.find(n => n.id === link.target);
        if (!sourceNode || !targetNode) return null;
        const isHighlighted = relevantLinks.has(`${link.source}-${link.target}`);
        return (
          <Edge
            key={`edge-${index}`}
            start={sourceNode.position}
            end={targetNode.position}
            value={link.value}
            isHighlighted={isHighlighted}
          />
        );
      })}
      {data.nodes.map(node => (
        <Node
          key={`node-${node.id}`}
          node={node}
          isSelected={selectedNode === node.id}
          isRelevant={relevantNodes.has(node.id)}
          onClick={handleNodeClick}
          showLabel={relevantNodes.has(node.id)}
          labelBig={selectedNode ? (selectedNode === node.id || (connectedNodes[selectedNode] && connectedNodes[selectedNode].has(node.id))) : false}
        />
      ))}
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
        absolute top-4 right-4 p-4 rounded-lg shadow-lg w-72 max-h-[60vh] overflow-y-auto
        ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}
      `}
    >
      <h3 className="text-lg font-bold mb-2 pb-2 border-b">{selectedEntity}</h3>
      
      <h4 className="text-sm font-semibold mt-3 mb-2">Top Emotions</h4>
      <div className="space-y-1">
        {Object.entries(entityInfo.emotions)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([emotion, score]) => (
            <div key={emotion} className="flex items-center justify-between">
              <span className="text-sm">{emotion}</span>
              <div className="w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                <div 
                  className="h-full" 
                  style={{ 
                    width: `${Math.min(score * 100, 100)}%`,
                    backgroundColor: getEmotionColor(emotion)
                  }}
                />
              </div>
            </div>
          ))}
      </div>
      
      {entityInfo.entries && entityInfo.entries.length > 0 && (
        <>
          <h4 className="text-sm font-semibold mt-4 mb-2">Journal Excerpts</h4>
          <div className="space-y-2 text-xs">
            {entityInfo.entries.map(entry => (
              <div 
                key={entry.id}
                className={`p-2 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
              >
                {entry.content.length > 120 
                  ? `${entry.content.substring(0, 120)}...` 
                  : entry.content}
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
};

const SoulNet: React.FC<SoulNetProps> = ({ userId, timeRange }) => {
  const [graphData, setGraphData] = useState<{nodes: NodeData[], links: LinkData[]}>({ nodes: [], links: [] });
  const [entityData, setEntityData] = useState<Record<string, {emotions: Record<string, number>, entries?: Array<{id: number, content: string}>}>>({});
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const { theme } = useTheme();

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

        Object.entries(entityEmotionMap).forEach(([entity, data], entityIndex) => {
          if (!entity.trim()) return;
          entityNodes.add(entity);
          const entityAngle = (entityIndex / Object.keys(entityEmotionMap).length) * Math.PI * 2;
          const entityRadius = 5;
          const entityX = Math.cos(entityAngle) * entityRadius;
          const entityY = (Math.random() - 0.5) * 3;
          const entityZ = Math.sin(entityAngle) * entityRadius;
          nodes.push({
            id: entity,
            type: 'entity',
            value: 1,
            color: '#ffffff',
            position: [entityX, entityY, entityZ]
          });
          Object.entries(data.emotions).forEach(([emotion, score]) => {
            if (!emotion.trim()) return;
            emotionNodes.add(emotion);
            links.push({
              source: entity,
              target: emotion,
              value: score
            });
          });
        });
        Array.from(emotionNodes).forEach((emotion, emotionIndex) => {
          if (!emotion.trim()) return;
          const emotionAngle = (emotionIndex / emotionNodes.size) * Math.PI * 2;
          const emotionRadius = 10;
          const emotionX = Math.cos(emotionAngle) * emotionRadius;
          const emotionY = (Math.random() - 0.5) * 6;
          const emotionZ = Math.sin(emotionAngle) * emotionRadius;
          nodes.push({
            id: emotion,
            type: 'emotion',
            value: 0.8,
            color: getEmotionColor(emotion),
            position: [emotionX, emotionY, emotionZ]
          });
        });

        const filteredNodes = nodes.filter(n => n.id && n.id.trim().length > 0);

        setGraphData({ nodes: filteredNodes, links });
      } catch (error) {
        console.error('Error processing entity-emotion data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEntityEmotionData();
  }, [userId, timeRange]);

  const handleCanvasClick = () => {
    setSelectedEntity(null);
  };

  const handleNodeSelect = (id: string) => {
    if (graphData.nodes.find(node => node.id === id)?.type === 'entity' || graphData.nodes.find(node => node.id === id)?.type === 'emotion') {
      setSelectedEntity(id === selectedEntity ? null : id);
    }
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
    <div className="relative w-full h-[600px] rounded-xl overflow-hidden border">
      <Canvas onClick={handleCanvasClick} camera={{ position: [0, 0, 15] }}>
        <SoulNetVisualization 
          data={graphData}
          onNodeSelect={handleNodeSelect}
          selectedNode={selectedEntity}
        />
      </Canvas>
      <div className="absolute bottom-4 left-4 p-3 rounded-lg bg-background/80 backdrop-blur-sm">
        <p className="text-xs text-muted-foreground">
          <b>Drag</b> to rotate • <b>Scroll</b> to zoom • <b>Click</b> a node to highlight connections
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
