import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Minimize2 } from 'lucide-react';
import { TranslatableText } from '../translation/TranslatableText';
import { Button } from '../ui/button';
import { useIsMobile } from '../../hooks/use-mobile';
import { useR3FBulkTranslation } from '../../hooks/useR3FBulkTranslation';
import { useTheme } from '@/hooks/use-theme';
import { BillboardText } from './BillboardText';
import { preloadCritical3DFonts } from '../../utils/imagePreloader';

// Types
interface SoulNet3DNode {
  id: string;
  name: string;
  type: 'theme' | 'emotion';
  intensity: number;
  position: [number, number, number];
  percentage?: number;
}

interface SoulNet3DLink {
  source: string;
  target: string;
  strength: number;
}

interface SoulNet3DData {
  nodes: SoulNet3DNode[];
  links: SoulNet3DLink[];
}

interface SoulNet3DProps {
  timeRange: any;
  insightsData: any;
  userId?: string;
  onTimeRangeChange?: (timeRange: any) => void;
}

// 3D Node Components
function ThemeNode({ 
  node, 
  isSelected, 
  isConnected, 
  isFaded, 
  onClick, 
  position,
  getTranslatedText,
  selectedNodeId,
  theme
}: {
  node: SoulNet3DNode;
  isSelected: boolean;
  isConnected: boolean;
  isFaded: boolean;
  onClick: () => void;
  position: [number, number, number];
  getTranslatedText: (text: string) => string;
  selectedNodeId: string | null;
  theme: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

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
      
      {/* Node Label - Hide if node is faded (unselected when another node is selected) */}
      {(!selectedNodeId || isSelected || isConnected) && (
        <BillboardText
          position={[0, 0, -1]}
          fontSize={0.375}
          color={theme === 'light' ? '#000000' : '#ffffff'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={theme === 'light' ? 0 : 0.02}
          outlineColor={theme === 'light' ? 'transparent' : '#000000'}
        >
          {getTranslatedText(node.name)}
        </BillboardText>
      )}

      {/* Percentage Label for connected nodes */}
      {(isSelected || isConnected) && node.percentage && (
        <BillboardText
          position={[0, 0, -1.5]}
          fontSize={0.3125}
          color="#ffd93d"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {`${node.percentage.toFixed(1)}%`}
        </BillboardText>
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
  position,
  getTranslatedText,
  selectedNodeId,
  theme
}: {
  node: SoulNet3DNode;
  isSelected: boolean;
  isConnected: boolean;
  isFaded: boolean;
  onClick: () => void;
  position: [number, number, number];
  getTranslatedText: (text: string) => string;
  selectedNodeId: string | null;
  theme: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

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
      
      {/* Node Label - Hide if node is faded (unselected when another node is selected) */}
      {(!selectedNodeId || isSelected || isConnected) && (
        <BillboardText
          position={[0, 0, -0.7]}
          fontSize={0.375}
          color={theme === 'light' ? '#000000' : '#ffffff'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={theme === 'light' ? 0 : 0.02}
          outlineColor={theme === 'light' ? 'transparent' : '#000000'}
        >
          {getTranslatedText(node.name)}
        </BillboardText>
      )}

      {/* Percentage Label for connected nodes */}
      {(isSelected || isConnected) && node.percentage && (
        <BillboardText
          position={[0, 0, -1.05]}
          fontSize={0.3125}
          color="#ffd93d"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {`${node.percentage.toFixed(1)}%`}
        </BillboardText>
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
        
        const material = new THREE.LineDashedMaterial({
          color: isHighlighted ? '#ffd93d' : '#999999',
          transparent: true,
          opacity: isFaded ? 0.05 : (isHighlighted ? 1 : 0.2),
          dashSize: 0.1,
          gapSize: 0.05
        });
        
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances(); // Required for dashed lines
        
        return (
          <primitive key={`${link.source}-${link.target}`} object={line} />
        );
      })}
    </group>
  );
}

// 3D Scene Component
function Scene3D({ data, selectedNodeId, onNodeClick, isMobile, getTranslatedText, theme }: {
  data: SoulNet3DData;
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string | null) => void;
  isMobile: boolean;
  getTranslatedText: (text: string) => string;
  theme: string;
}) {
  const { camera, gl, scene } = useThree();

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
    // Set camera position to look up the Z-axis (new orientation: Z points up)
    camera.position.set(0, -30.8, 0);
    camera.up.set(0, 0, 1); // Set up vector to Z axis
  }, [camera]);

  const handleNodeClick = useCallback((nodeId: string) => {
    onNodeClick(selectedNodeId === nodeId ? null : nodeId);
  }, [selectedNodeId, onNodeClick]);

  // Handle clicking on background to deselect
  const handleBackgroundClick = useCallback(() => {
    if (selectedNodeId) {
      onNodeClick(null);
    }
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
              getTranslatedText={getTranslatedText}
              selectedNodeId={selectedNodeId}
              theme={theme}
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
              getTranslatedText={getTranslatedText}
              selectedNodeId={selectedNodeId}
              theme={theme}
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
export function SoulNet3D({ timeRange, insightsData, userId, onTimeRangeChange }: SoulNet3DProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [forceRender, setForceRender] = useState(false);
  const mobileDetection = useIsMobile();
  const isMobile = mobileDetection.isMobile;

  // Master timeout to force render if resources take too long
  useEffect(() => {
    const masterTimeout = setTimeout(() => {
      console.warn('SoulNet3D: Master timeout reached, forcing render with available resources');
      setForceRender(true);
      setFontsLoaded(true);
    }, 8000); // 8 second maximum wait time for everything

    return () => clearTimeout(masterTimeout);
  }, []);

  // Preload 3D fonts on component mount with timeout fallback
  useEffect(() => {
    const fontTimeout = setTimeout(() => {
      console.warn('Font loading timeout reached, proceeding with default fonts');
      setFontsLoaded(true);
    }, 3000); // Reduced to 3 seconds

    preloadCritical3DFonts()
      .then(() => {
        console.log('3D fonts loaded successfully');
      })
      .catch((error) => {
        console.warn('Font loading failed, proceeding with fallback:', error);
      })
      .finally(() => {
        clearTimeout(fontTimeout);
        setFontsLoaded(true);
      });

    return () => clearTimeout(fontTimeout);
  }, []);
  
  // Defensive theme access with fallback
  let theme = 'dark';
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;
  } catch (error) {
    console.warn('SoulNet3D: ThemeProvider not ready, using default theme');
  }

  // Extract unique labels for translation
  const uniqueLabels = useMemo(() => {
    if (!insightsData?.allEntries?.length) return [];
    
    const labels = new Set<string>();
    insightsData.allEntries.forEach((entry: any) => {
      if (entry.themeemotion && typeof entry.themeemotion === 'object') {
        Object.entries(entry.themeemotion).forEach(([theme, emotions]: [string, any]) => {
          labels.add(theme);
          if (emotions && typeof emotions === 'object') {
            Object.keys(emotions).forEach(emotion => labels.add(emotion));
          }
        });
      }
    });
    return Array.from(labels);
  }, [insightsData]);

  // Use bulk translation for all labels with timeout
  const { getTranslatedText, isComplete: translationsComplete } = useR3FBulkTranslation(uniqueLabels);
  
  // Add translation timeout handling
  const [translationsReady, setTranslationsReady] = useState(false);
  
  useEffect(() => {
    if (translationsComplete) {
      setTranslationsReady(true);
      return;
    }
    
    const translationTimeout = setTimeout(() => {
      console.warn('Translation timeout reached, proceeding with original text');
      setTranslationsReady(true);
    }, 5000); // 5 second timeout for translations
    
    return () => clearTimeout(translationTimeout);
  }, [translationsComplete]);

  // Process data from themeemotion column with time filtering
  const processedData = useMemo((): SoulNet3DData => {
    if (!insightsData?.allEntries?.length) {
      return { nodes: [], links: [] };
    }

    // Filter entries based on timeRange - use entries instead of allEntries for time filtering
    const filteredEntries = insightsData?.entries || insightsData?.allEntries || [];

    const nodes: SoulNet3DNode[] = [];
    const links: SoulNet3DLink[] = [];

    // Step 1: Collect all themes and emotions with their intensities
    const themeMap = new Map<string, { totalIntensity: number; count: number }>();
    const emotionMap = new Map<string, { totalIntensity: number; count: number }>();
    const themeEmotionConnections = new Map<string, Map<string, { intensity: number; count: number }>>();

    // Process themeemotion data using filtered entries
    filteredEntries.forEach((entry: any) => {
      if (entry.themeemotion && typeof entry.themeemotion === 'object') {
        Object.entries(entry.themeemotion).forEach(([theme, emotions]: [string, any]) => {
          
          // Update theme intensity
          if (!themeMap.has(theme)) {
            themeMap.set(theme, { totalIntensity: 0, count: 0 });
          }
          
          if (emotions && typeof emotions === 'object') {
            Object.entries(emotions).forEach(([emotion, intensity]: [string, any]) => {
              const intensityValue = typeof intensity === 'number' ? intensity : 0;
              
              // Update global emotion intensity
              if (!emotionMap.has(emotion)) {
                emotionMap.set(emotion, { totalIntensity: 0, count: 0 });
              }
              const emotionData = emotionMap.get(emotion)!;
              emotionData.totalIntensity += intensityValue;
              emotionData.count += 1;
              
              // Update theme intensity
              const themeData = themeMap.get(theme)!;
              themeData.totalIntensity += intensityValue;
              themeData.count += 1;
              
              // Track theme-emotion connections
              if (!themeEmotionConnections.has(theme)) {
                themeEmotionConnections.set(theme, new Map());
              }
              const themeConnections = themeEmotionConnections.get(theme)!;
              if (!themeConnections.has(emotion)) {
                themeConnections.set(emotion, { intensity: 0, count: 0 });
              }
              const connectionData = themeConnections.get(emotion)!;
              connectionData.intensity += intensityValue;
              connectionData.count += 1;
            });
          }
        });
      }
    });

    // Step 2: Create unique theme nodes (inner circle)
    const themes = Array.from(themeMap.keys());
    const themeZPattern = [-1, 1, -2, 2]; // Z-plane pattern for themes
    themes.forEach((theme, index) => {
      const angle = (index / themes.length) * 2 * Math.PI;
      const radius = 4.8; // Themes in inner circle
      const themeData = themeMap.get(theme)!;
      const zIndex = themeZPattern[index % themeZPattern.length];
      
      nodes.push({
        id: theme,
        name: theme,
        type: 'theme',
        intensity: Math.min(themeData.totalIntensity / 10, 1),
        position: [
          Math.cos(angle) * radius,
          zIndex,
          Math.sin(angle) * radius
        ]
      });
    });

    // Step 3: Create unique emotion nodes (outer circle)
    const emotions = Array.from(emotionMap.keys());
    const emotionZPattern = [-3.5, 3.5, -5, 5, -6.5, 6.5, -8, 8]; // Z-plane pattern for emotions
    emotions.forEach((emotion, index) => {
      const angle = (index / emotions.length) * 2 * Math.PI;
      const radius = 7.2; // Emotions in outer circle
      const emotionData = emotionMap.get(emotion)!;
      const zIndex = emotionZPattern[index % emotionZPattern.length];
      
      nodes.push({
        id: emotion,
        name: emotion,
        type: 'emotion',
        intensity: Math.min(emotionData.totalIntensity / Math.max(emotionData.count, 1), 1),
        position: [
          Math.cos(angle) * radius,
          zIndex,
          Math.sin(angle) * radius
        ]
      });
    });

    // Step 4: Create links from themes to emotions
    themeEmotionConnections.forEach((emotionConnections, theme) => {
      emotionConnections.forEach((connectionData, emotion) => {
        // Calculate link strength based on emotion's intensity for this theme
        const linkStrength = connectionData.intensity / Math.max(connectionData.count, 1);
        
        links.push({
          source: theme,
          target: emotion,
          strength: Math.min(linkStrength, 1)
        });
      });
    });

    return { nodes, links };
  }, [insightsData, timeRange]);

  const handleNodeClick = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    
    if (nodeId) {
      const selectedNode = processedData.nodes.find(n => n.id === nodeId);
      
      if (selectedNode?.type === 'emotion') {
        // For emotion nodes, calculate percentages for connected themes
        const connectedThemes = processedData.links
          .filter(link => link.target === nodeId)
          .map(link => link.source);
        
        const totalConnectionScore = processedData.links
          .filter(link => link.target === nodeId)
          .reduce((sum, link) => sum + link.strength, 0);

        // Update theme node percentages
        processedData.nodes.forEach(node => {
          if (connectedThemes.includes(node.id)) {
            const link = processedData.links.find(l => 
              l.target === nodeId && l.source === node.id
            );
            if (link && totalConnectionScore > 0) {
              node.percentage = (link.strength / totalConnectionScore) * 100;
            }
          } else {
            node.percentage = undefined;
          }
        });
        
        // Clear percentage for the selected emotion node itself
        selectedNode.percentage = undefined;
      } else {
        // For theme nodes, use existing logic
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
          } else {
            node.percentage = undefined;
          }
        });
      }
    } else {
      // Clear all percentages when no node is selected
      processedData.nodes.forEach(node => {
        node.percentage = undefined;
      });
    }
  }, [processedData]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  if (processedData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-card/50 rounded-lg border">
        <p className="text-muted-foreground">
          <TranslatableText text="No theme-emotion connections found for the selected time period." />
        </p>
      </div>
    );
  }

  const containerClass = isFullscreen 
    ? "fixed inset-0 z-50 bg-background"
    : "relative w-full bg-card/50 rounded-lg border overflow-hidden px-[10%]";
  
  // Increase height by 30%
  const canvasHeight = isFullscreen 
    ? "100vh" 
    : isMobile ? "520px" : "780px";

  return (
    <motion.div 
      className={containerClass}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          <TranslatableText text="Soul-Net" />
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

      {/* 3D Canvas - Render when resources are ready or force render is triggered */}
      {(translationsReady && fontsLoaded) || forceRender ? (
        <Canvas
          style={{ height: canvasHeight }}
          camera={{ position: [0, -30.8, 0], fov: 75, up: [0, 0, 1] }}
          onPointerMissed={() => setSelectedNodeId(null)}
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
            getTranslatedText={getTranslatedText}
            theme={theme}
          />
        </Canvas>
      ) : (
        <div className="flex items-center justify-center" style={{ height: canvasHeight }}>
          <div className="text-muted-foreground">
            <TranslatableText text="Loading visualization..." />
          </div>
        </div>
      )}

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
              <div className="font-semibold">
                {getTranslatedText(processedData.nodes.find(n => n.id === selectedNodeId)?.name || "")}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}