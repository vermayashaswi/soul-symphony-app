
import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Node from './Node';
import Edge from './Edge';
import { TimeRange } from '@/hooks/use-insights-data';
import RobustTranslatableText3D from './RobustTranslatableText3D';
import UnifiedNodeLabel from './UnifiedNodeLabel';
import RobustConnectionPercentage from './RobustConnectionPercentage';

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

interface GraphData {
  nodes: NodeData[];
  links: LinkData[];
}

interface SimplifiedSoulNetVisualizationProps {
  data: GraphData;
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
  themeHex: string;
  isFullScreen?: boolean;
  shouldShowLabels?: boolean;
  getInstantConnectionPercentage: (nodeId: string, connectedNodeId: string) => number;
  getInstantTranslation: (text: string) => string | null;
  getInstantNodeConnections: (nodeId: string) => Set<string>;
  isInstantReady: boolean;
  userId?: string;
  timeRange?: TimeRange;
  retryKey?: number;
}

const SimplifiedSoulNetVisualization: React.FC<SimplifiedSoulNetVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex,
  isFullScreen = false,
  shouldShowLabels = true,
  getInstantConnectionPercentage,
  getInstantTranslation,
  getInstantNodeConnections,
  isInstantReady,
  userId,
  timeRange,
  retryKey = 0
}) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>();
  const [cameraZoom, setCameraZoom] = useState(45);
  const [highlightedConnections, setHighlightedConnections] = useState<Set<string>>(new Set());

  console.log(`[SimplifiedSoulNetVisualization] Rendering with ${data.nodes.length} nodes, selectedNode: ${selectedNode}, retryKey: ${retryKey}`);

  // Track camera zoom for responsive text sizing
  useFrame(() => {
    if (camera && camera.position) {
      const distance = camera.position.length();
      setCameraZoom(distance);
    }
  });

  // Handle node selection and connection highlighting
  useEffect(() => {
    if (selectedNode && isInstantReady) {
      const connections = getInstantNodeConnections(selectedNode);
      setHighlightedConnections(connections);
      console.log(`[SimplifiedSoulNetVisualization] Selected ${selectedNode}, highlighting ${connections.size} connections`);
    } else {
      setHighlightedConnections(new Set());
    }
  }, [selectedNode, getInstantNodeConnections, isInstantReady]);

  // Memoized nodes with enhanced error handling
  const renderedNodes = useMemo(() => {
    if (!data.nodes || data.nodes.length === 0) {
      console.log('[SimplifiedSoulNetVisualization] No nodes to render');
      return [];
    }

    return data.nodes.map((node) => {
      const isSelected = selectedNode === node.id;
      const isHighlighted = highlightedConnections.has(node.id);
      const nodeScale = isSelected ? 1.5 : isHighlighted ? 1.2 : 1;
      
      return (
        <React.Fragment key={`${node.id}-${retryKey}`}>
          <Node
            id={node.id}
            position={node.position}
            color={node.color}
            type={node.type}
            value={node.value}
            isSelected={isSelected}
            isHighlighted={isHighlighted}
            onClick={onNodeClick}
            scale={nodeScale}
            themeHex={themeHex}
          />
          
          {shouldShowLabels && isInstantReady && (
            <UnifiedNodeLabel
              id={node.id}
              type={node.type}
              position={node.position}
              isHighlighted={isHighlighted}
              isSelected={isSelected}
              shouldShowLabel={true}
              cameraZoom={cameraZoom}
              themeHex={themeHex}
              nodeScale={nodeScale}
              retryKey={retryKey}
            />
          )}
          
          {/* Show connection percentage for selected node */}
          {isSelected && selectedNode && highlightedConnections.size > 0 && (
            <RobustConnectionPercentage
              position={node.position}
              percentage={75} // Default percentage, could be enhanced with actual data
              isVisible={true}
              nodeType={node.type}
            />
          )}
        </React.Fragment>
      );
    });
  }, [
    data.nodes, 
    selectedNode, 
    highlightedConnections, 
    onNodeClick, 
    shouldShowLabels, 
    isInstantReady, 
    cameraZoom, 
    themeHex,
    retryKey
  ]);

  // Memoized edges with enhanced highlighting
  const renderedEdges = useMemo(() => {
    if (!data.links || data.links.length === 0) {
      console.log('[SimplifiedSoulNetVisualization] No links to render');
      return [];
    }

    return data.links.map((link, index) => {
      const sourceNode = data.nodes.find(n => n.id === link.source);
      const targetNode = data.nodes.find(n => n.id === link.target);
      
      if (!sourceNode || !targetNode) {
        console.warn(`[SimplifiedSoulNetVisualization] Missing node for link: ${link.source} -> ${link.target}`);
        return null;
      }

      const isHighlighted = selectedNode && (
        link.source === selectedNode || 
        link.target === selectedNode ||
        (highlightedConnections.has(link.source) && highlightedConnections.has(link.target))
      );

      return (
        <Edge
          key={`${link.source}-${link.target}-${index}-${retryKey}`}
          start={sourceNode.position}
          end={targetNode.position}
          value={link.value}
          isHighlighted={isHighlighted}
          themeHex={themeHex}
        />
      );
    }).filter(Boolean);
  }, [data.links, data.nodes, selectedNode, highlightedConnections, themeHex, retryKey]);

  if (!data.nodes || data.nodes.length === 0) {
    console.log('[SimplifiedSoulNetVisualization] No data available for visualization');
    return null;
  }

  console.log(`[SimplifiedSoulNetVisualization] Final render: ${renderedNodes.length} nodes, ${renderedEdges.length} edges`);

  return (
    <>
      {/* Enhanced lighting for better visibility */}
      <ambientLight intensity={0.6} />
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={0.8} 
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-10, -10, -5]} intensity={0.4} />
      
      {/* Enhanced camera controls */}
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.1}
        enableZoom
        enableRotate
        enablePan={isFullScreen}
        minDistance={isFullScreen ? 20 : 25}
        maxDistance={isFullScreen ? 100 : 80}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI - 0.2}
        rotateSpeed={0.8}
        zoomSpeed={1.2}
        panSpeed={0.8}
      />
      
      {/* Render all nodes */}
      {renderedNodes}
      
      {/* Render all edges */}
      {renderedEdges}
    </>
  );
};

export default SimplifiedSoulNetVisualization;
