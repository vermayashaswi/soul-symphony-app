import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Minimize2 } from 'lucide-react';
import { TranslatableText } from '../translation/TranslatableText';
import { Button } from '../ui/button';
import { useIsMobile } from '../../hooks/use-mobile';
import { useR3FTranslation, useR3FTranslations } from '../../hooks/useR3FTranslation';

// Types
interface SoulNet3DNode {
  id: string;
  label: string;
  type: 'theme' | 'emotion';
  intensity: number;
  connections: number;
  position: [number, number, number];
  percentage?: number;
}

interface SoulNet3DLink {
  source: string;
  target: string;
  strength: number;
  percentage: number;
}

interface SoulNet3DData {
  nodes: SoulNet3DNode[];
  links: SoulNet3DLink[];
}

interface SoulNet3DProps {
  timeRange: any;
  insightsData: any;
  userId?: string;
}

// Helper function to filter data by time range
function filterDataByTimeRange(data: any, timeRange: any) {
  if (!data?.allEntries || !timeRange) return data;
  
  const now = new Date();
  let startDate: Date;
  
  switch (timeRange) {
    case 'day':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'year':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      return data; // No filtering for custom ranges or unrecognized values
  }
  
  const filteredEntries = data.allEntries.filter((entry: any) => {
    const entryDate = new Date(entry.created_at);
    return entryDate >= startDate && entryDate <= now;
  });
  
  return {
    ...data,
    allEntries: filteredEntries
  };
}

// 3D Node Components
function ThemeNode({ 
  node, 
  isSelected, 
  isConnected, 
  isFaded, 
  onClick, 
  position 
}: {
  node: SoulNet3DNode;
  isSelected: boolean;
  isConnected: boolean;
  isFaded: boolean;
  onClick: () => void;
  position: [number, number, number];
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { translatedText } = useR3FTranslation(node.label);

  useFrame((state) => {
    if (meshRef.current) {
      // Rotation animation
      meshRef.current.rotation.y += 0.01;
      
      // Pulsing animation for selected/connected nodes
      if (isSelected || isConnected) {
        const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.1 + 1;
        meshRef.current.scale.setScalar(pulse);
      } else {
        meshRef.current.scale.setScalar(isFaded ? 0.3 : 1);
      }
    }
  });

  const color = isSelected ? '#ff6b6b' : isConnected ? '#4ecdc4' : '#667eea';
  const opacity = isFaded ? 0.2 : 1;

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.5 + node.intensity * 0.3, 32, 32]} />
        <meshStandardMaterial 
          color={color} 
          transparent 
          opacity={opacity}
          emissive={isSelected || isConnected ? color : '#000000'}
          emissiveIntensity={isSelected || isConnected ? 0.2 : 0}
        />
      </mesh>
      
      {/* Node Label - Billboard ensures it always faces the camera */}
      <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
        <Text
          position={[0, -1, 0]}
          fontSize={0.3}
          color={isFaded ? '#666666' : '#ffffff'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {translatedText}
        </Text>
      </Billboard>

      {/* Percentage Label for connected nodes */}
      {(isSelected || isConnected) && node.percentage && (
        <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
          <Text
            position={[0, -1.5, 0]}
            fontSize={0.25}
            color="#ffd93d"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {`${node.percentage.toFixed(1)}%`}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

function EmotionNode({ 
  node, 
  isSelected, 
  isConnected, 
  isFaded, 
  onClick, 
  position 
}: {
  node: SoulNet3DNode;
  isSelected: boolean;
  isConnected: boolean;
  isFaded: boolean;
  onClick: () => void;
  position: [number, number, number];
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { translatedText } = useR3FTranslation(node.label);

  useFrame((state) => {
    if (meshRef.current) {
      // Rotation animation
      meshRef.current.rotation.x += 0.008;
      meshRef.current.rotation.y += 0.01;
      
      // Pulsing animation for selected/connected nodes
      if (isSelected || isConnected) {
        const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.1 + 1;
        meshRef.current.scale.setScalar(pulse);
      } else {
        meshRef.current.scale.setScalar(isFaded ? 0.3 : 1);
      }
    }
  });

  const color = isSelected ? '#ff6b6b' : isConnected ? '#4ecdc4' : '#a78bfa';
  const opacity = isFaded ? 0.2 : 1;

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[0.6 + node.intensity * 0.4, 0.6 + node.intensity * 0.4, 0.6 + node.intensity * 0.4]} />
        <meshStandardMaterial 
          color={color} 
          transparent 
          opacity={opacity}
          emissive={isSelected || isConnected ? color : '#000000'}
          emissiveIntensity={isSelected || isConnected ? 0.2 : 0}
        />
      </mesh>
      
      {/* Node Label - Billboard ensures it always faces the camera */}
      <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
        <Text
          position={[0, -1, 0]}
          fontSize={0.3}
          color={isFaded ? '#666666' : '#ffffff'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {translatedText}
        </Text>
      </Billboard>

      {/* Percentage Label for connected nodes */}
      {(isSelected || isConnected) && node.percentage && (
        <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
          <Text
            position={[0, -1.5, 0]}
            fontSize={0.25}
            color="#ffd93d"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {`${node.percentage.toFixed(1)}%`}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

// Connection Lines Component
function ConnectionLines({ 
  links, 
  nodes, 
  selectedNodeId, 
  connectedNodeIds 
}: {
  links: SoulNet3DLink[];
  nodes: SoulNet3DNode[];
  selectedNodeId: string | null;
  connectedNodeIds: Set<string>;
}) {
  const nodePositions = useMemo(() => {
    const positions: { [key: string]: [number, number, number] } = {};
    nodes.forEach(node => {
      positions[node.id] = node.position;
    });
    return positions;
  }, [nodes]);

  return (
    <group>
      {links.map((link, index) => {
        const sourcePos = nodePositions[link.source];
        const targetPos = nodePositions[link.target];
        
        if (!sourcePos || !targetPos) return null;

        const isHighlighted = selectedNodeId && 
          (link.source === selectedNodeId || link.target === selectedNodeId);
        const isFaded = selectedNodeId && !isHighlighted;

        const points = [
          new THREE.Vector3(...sourcePos),
          new THREE.Vector3(...targetPos)
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        const material = new THREE.LineBasicMaterial({
          color: isHighlighted ? '#ffd93d' : '#ffffff',
          transparent: true,
          opacity: isFaded ? 0.1 : (isHighlighted ? 1 : 0.6)
        });
        
        const line = new THREE.Line(geometry, material);
        
        return (
          <primitive key={`${link.source}-${link.target}`} object={line} />
        );
      })}
    </group>
  );
}

// 3D Scene Component
function Scene3D({ data, selectedNodeId, onNodeClick, isMobile }: {
  data: SoulNet3DData;
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string | null) => void;
  isMobile: boolean;
}) {
  const { camera } = useThree();

  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    
    const connected = new Set<string>();
    data.links.forEach(link => {
      if (link.source === selectedNodeId) {
        connected.add(link.target);
      } else if (link.target === selectedNodeId) {
        connected.add(link.source);
      }
    });
    return connected;
  }, [selectedNodeId, data.links]);

  useEffect(() => {
    // Set initial camera position
    camera.position.set(0, 0, 15);
  }, [camera]);

  const handleNodeClick = useCallback((nodeId: string) => {
    onNodeClick(selectedNodeId === nodeId ? null : nodeId);
  }, [selectedNodeId, onNodeClick]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
      <hemisphereLight args={["#ffffff", "#606060", 0.6]} />

      {/* Nodes */}
      {data.nodes.map(node => {
        const isSelected = selectedNodeId === node.id;
        const isConnected = connectedNodeIds.has(node.id);
        const isFaded = selectedNodeId !== null && !isSelected && !isConnected;

        if (node.type === 'theme') {
          return (
            <ThemeNode
              key={node.id}
              node={node}
              position={node.position}
              isSelected={isSelected}
              isConnected={isConnected}
              isFaded={isFaded}
              onClick={() => handleNodeClick(node.id)}
            />
          );
        } else {
          return (
            <EmotionNode
              key={node.id}
              node={node}
              position={node.position}
              isSelected={isSelected}
              isConnected={isConnected}
              isFaded={isFaded}
              onClick={() => handleNodeClick(node.id)}
            />
          );
        }
      })}

      {/* Connection Lines */}
      <ConnectionLines 
        links={data.links}
        nodes={data.nodes}
        selectedNodeId={selectedNodeId}
        connectedNodeIds={connectedNodeIds}
      />

      {/* Controls */}
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={50}
        autoRotate={selectedNodeId === null}
        autoRotateSpeed={0.5}
        enableDamping={true}
        dampingFactor={0.05}
        screenSpacePanning={false}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
        rotateSpeed={isMobile ? 0.5 : 1}
        zoomSpeed={isMobile ? 0.5 : 1}
        panSpeed={isMobile ? 0.5 : 1}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN
        }}
      />

      {/* Fog for depth */}
      <fog attach="fog" args={['#1a1a2e', 20, 100]} />
    </>
  );
}

// Main SoulNet3D Component
export function SoulNet3D({ timeRange, insightsData, userId }: SoulNet3DProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mobileDetection = useIsMobile();
  const isMobile = mobileDetection.isMobile;

  // Filter data based on time range
  const filteredData = useMemo(() => {
    return filterDataByTimeRange(insightsData, timeRange);
  }, [insightsData, timeRange]);

  // Pre-load translations for key UI text
  const uiTexts = [
    "Soul Network - 3D Visualization",
    "No theme-emotion connections found for the selected time period.",
    "Connected elements show percentage distribution"
  ];
  const mobileInteractionText = isMobile 
    ? "Tap themes (spheres) or emotions (cubes) to explore connections. Use touch to rotate, pinch to zoom, and drag to pan."
    : "Click themes (spheres) or emotions (cubes) to explore connections. Use mouse to rotate, zoom, and pan.";
  
  const allTexts = [...uiTexts, mobileInteractionText];
  const { translatedTexts, isLoading: translationsLoading } = useR3FTranslations(allTexts);

  // Process data from themeemotion column
  const processedData = useMemo((): SoulNet3DData => {
    if (!filteredData?.allEntries?.length) {
      return { nodes: [], links: [] };
    }

    const themeEmotionMap = new Map<string, Map<string, { count: number; totalIntensity: number }>>();
    const themeIntensities = new Map<string, number>();
    const emotionIntensities = new Map<string, number>();

    // Process themeemotion data
    filteredData.allEntries.forEach((entry: any) => {
      if (entry.themeemotion && typeof entry.themeemotion === 'object') {
        Object.entries(entry.themeemotion).forEach(([theme, emotions]: [string, any]) => {
          if (!themeEmotionMap.has(theme)) {
            themeEmotionMap.set(theme, new Map());
          }
          
          const themeMap = themeEmotionMap.get(theme)!;
          let themeTotal = 0;

          if (emotions && typeof emotions === 'object') {
            Object.entries(emotions).forEach(([emotion, intensity]: [string, any]) => {
              const intensityValue = typeof intensity === 'number' ? intensity : 0;
              
              if (!themeMap.has(emotion)) {
                themeMap.set(emotion, { count: 0, totalIntensity: 0 });
              }
              
              const emotionData = themeMap.get(emotion)!;
              emotionData.count += 1;
              emotionData.totalIntensity += intensityValue;
              
              themeTotal += intensityValue;
              
              // Update emotion intensity
              emotionIntensities.set(emotion, (emotionIntensities.get(emotion) || 0) + intensityValue);
            });
          }

          // Update theme intensity
          themeIntensities.set(theme, (themeIntensities.get(theme) || 0) + themeTotal);
        });
      }
    });

    // Create nodes and calculate positions
    const nodes: SoulNet3DNode[] = [];
    const links: SoulNet3DLink[] = [];
    
    // Generate theme nodes - positioned between Y -2 to +2
    const themes = Array.from(themeEmotionMap.keys());
    themes.forEach((theme, index) => {
      const angle = (index / themes.length) * Math.PI * 2;
      const radius = 6;
      const yPos = -2 + (4 * (index / Math.max(themes.length - 1, 1))); // Spread between -2 and +2
      
      nodes.push({
        id: theme,
        label: theme,
        type: 'theme',
        intensity: Math.min((themeIntensities.get(theme) || 0) / 10, 1),
        connections: themeEmotionMap.get(theme)?.size || 0,
        position: [
          Math.cos(angle) * radius,
          yPos,
          Math.sin(angle) * radius
        ]
      });
    });

    // Generate emotion nodes and links
    themeEmotionMap.forEach((emotions, theme) => {
      const themeNode = nodes.find(n => n.id === theme);
      if (!themeNode) return;

      const emotionArray = Array.from(emotions.entries());
      const totalThemeIntensity = emotionArray.reduce((sum, [, data]) => sum + data.totalIntensity, 0);

      emotionArray.forEach(([emotion, data], index) => {
        const emotionId = `${theme}-${emotion}`;
        
        // Calculate percentage for this emotion relative to the theme
        const percentage = totalThemeIntensity > 0 ? (data.totalIntensity / totalThemeIntensity) * 100 : 0;
        
        // Position emotions around their theme - Y between -8 to -3 and +3 to +8
        const angle = (index / emotionArray.length) * Math.PI * 2;
        const distance = 2 + data.totalIntensity * 0.5;
        
        // Alternate between negative (-8 to -3) and positive (+3 to +8) Y ranges
        const isNegativeRange = index % 2 === 0;
        const rangePosition = index / emotionArray.length;
        const yPos = isNegativeRange 
          ? -8 + (rangePosition * 5) // -8 to -3
          : 3 + (rangePosition * 5);  // +3 to +8
        
        const emotionNode: SoulNet3DNode = {
          id: emotionId,
          label: emotion,
          type: 'emotion',
          intensity: Math.min(data.totalIntensity / 5, 1),
          connections: 1,
          position: [
            themeNode.position[0] + Math.cos(angle) * distance,
            yPos,
            themeNode.position[2] + Math.sin(angle) * distance
          ],
          percentage
        };

        nodes.push(emotionNode);

        // Create link
        links.push({
          source: theme,
          target: emotionId,
          strength: Math.min(data.totalIntensity / 5, 1),
          percentage
        });
      });
    });

    return { nodes, links };
  }, [filteredData]);

  const handleNodeClick = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    
    if (nodeId) {
      // Calculate percentages for connected nodes
      const connectedNodes = processedData.links
        .filter(link => link.source === nodeId || link.target === nodeId)
        .map(link => link.source === nodeId ? link.target : link.source);
      
      const totalIntensity = processedData.links
        .filter(link => link.source === nodeId || link.target === nodeId)
        .reduce((sum, link) => sum + link.strength, 0);

      // Update node percentages
      processedData.nodes.forEach(node => {
        if (connectedNodes.includes(node.id)) {
          const link = processedData.links.find(l => 
            (l.source === nodeId && l.target === node.id) || 
            (l.target === nodeId && l.source === node.id)
          );
          if (link && totalIntensity > 0) {
            node.percentage = (link.strength / totalIntensity) * 100;
          }
        }
      });
    }
  }, [processedData]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Show loading state while translations are loading
  if (translationsLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-card/50 rounded-lg border">
        <p className="text-muted-foreground">Loading visualization...</p>
      </div>
    );
  }

  if (processedData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-card/50 rounded-lg border">
        <p className="text-muted-foreground">
          {translatedTexts[1] || "No theme-emotion connections found for the selected time period."}
        </p>
      </div>
    );
  }

  const containerClass = isFullscreen 
    ? "fixed inset-0 z-50 bg-background"
    : "relative w-full bg-card/50 rounded-lg border overflow-hidden";
  
  // Increase container height by 25%
  const canvasHeight = isFullscreen 
    ? "100vh" 
    : isMobile ? "500px" : "750px"; // 400px -> 500px (+25%), 600px -> 750px (+25%)

  return (
    <motion.div 
      className={containerClass}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          {translatedTexts[0] || "Soul Network - 3D Visualization"}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleFullscreen}
          className="bg-background/80 backdrop-blur-sm"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Instructions - Updated for mobile touch gestures */}
      {selectedNodeId === null && (
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="bg-background/80 backdrop-blur-sm rounded-lg p-3 text-sm text-muted-foreground text-center">
            {translatedTexts[3] || mobileInteractionText}
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas
        style={{ height: canvasHeight }}
        camera={{ position: [0, 0, 15], fov: 75 }}
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: "high-performance"
        }}
      >
        <Scene3D 
          data={processedData}
          selectedNodeId={selectedNodeId}
          onNodeClick={handleNodeClick}
          isMobile={isMobile}
        />
      </Canvas>

      {/* Selected Node Info */}
      <AnimatePresence>
        {selectedNodeId && (
          <motion.div
            className="absolute top-20 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-4 max-w-xs"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <div className="text-sm">
              <div className="font-semibold mb-2">
                {processedData.nodes.find(n => n.id === selectedNodeId)?.label || ""}
              </div>
              <div className="text-muted-foreground">
                {translatedTexts[2] || "Connected elements show percentage distribution"}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}