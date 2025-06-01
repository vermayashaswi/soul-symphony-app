
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import Node from './Node';
import Edge from './Edge';
import FallbackVisualization from './FallbackVisualization';
import * as THREE from 'three';

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

interface SimplifiedSoulNetVisualizationProps {
  data: { nodes: NodeData[]; links: LinkData[] };
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
  themeHex: string;
  isFullScreen?: boolean;
  shouldShowLabels?: boolean;
}

export const SimplifiedSoulNetVisualization: React.FC<SimplifiedSoulNetVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex,
  isFullScreen = false,
  shouldShowLabels = true
}) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const [cameraZoom, setCameraZoom] = useState<number>(45);
  const [renderingMode, setRenderingMode] = useState<'full' | 'simplified' | 'fallback'>('full');
  const [isInitialized, setIsInitialized] = useState(false);
  const renderingErrorCount = useRef<number>(0);
  
  console.log("[SimplifiedSoulNetVisualization] Rendering in mode:", renderingMode);

  // Validate data
  const validData = useMemo(() => {
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
      console.warn('[SimplifiedSoulNetVisualization] Invalid data structure');
      return { nodes: [], links: [] };
    }
    return {
      nodes: data.nodes.filter(node => node && node.id && Array.isArray(node.position)),
      links: data.links.filter(link => link && link.source && link.target)
    };
  }, [data]);

  // Calculate center position
  const centerPosition = useMemo(() => {
    if (validData.nodes.length === 0) return new THREE.Vector3(0, 0, 0);
    
    const positions = validData.nodes.map(node => node.position);
    const centerX = positions.reduce((sum, pos) => sum + pos[0], 0) / positions.length;
    const centerY = positions.reduce((sum, pos) => sum + pos[1], 0) / positions.length;
    
    return new THREE.Vector3(centerX, centerY, 0);
  }, [validData.nodes]);

  // Initialize camera
  useEffect(() => {
    if (camera && validData.nodes.length > 0 && !isInitialized) {
      try {
        camera.position.set(centerPosition.x, centerPosition.y, 45);
        camera.lookAt(centerPosition.x, centerPosition.y, 0);
        setIsInitialized(true);
        console.log('[SimplifiedSoulNetVisualization] Camera initialized');
      } catch (error) {
        console.error('Camera initialization error:', error);
        setRenderingMode('fallback');
      }
    }
  }, [camera, validData.nodes, centerPosition, isInitialized]);

  // Track camera zoom
  useEffect(() => {
    const updateZoom = () => {
      if (camera) {
        setCameraZoom(camera.position.z);
      }
    };

    const intervalId = setInterval(updateZoom, 200);
    return () => clearInterval(intervalId);
  }, [camera]);

  // Handle rendering errors
  const handleRenderingError = (error: Error) => {
    renderingErrorCount.current += 1;
    console.error('[SimplifiedSoulNetVisualization] Rendering error:', error);

    if (renderingErrorCount.current > 2) {
      setRenderingMode('fallback');
    } else if (renderingErrorCount.current > 1) {
      setRenderingMode('simplified');
    }
  };

  // Calculate highlighted nodes
  const highlightedNodes = useMemo(() => {
    if (!selectedNode || !validData.links) return new Set<string>();
    
    const connected = new Set<string>();
    validData.links.forEach(link => {
      if (link.source === selectedNode) connected.add(link.target);
      if (link.target === selectedNode) connected.add(link.source);
    });
    return connected;
  }, [selectedNode, validData.links]);

  // Fallback mode
  if (renderingMode === 'fallback') {
    console.log('[SimplifiedSoulNetVisualization] Using fallback visualization');
    return (
      <FallbackVisualization
        data={validData}
        selectedNode={selectedNode}
        onNodeClick={onNodeClick}
        themeHex={themeHex}
      />
    );
  }

  try {
    return (
      <>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          minDistance={isFullScreen ? 8 : 10}
          maxDistance={isFullScreen ? 80 : 60}
          target={centerPosition}
          onChange={() => {
            if (camera) {
              setCameraZoom(camera.position.z);
            }
          }}
        />

        {/* Render edges in non-fallback mode */}
        {validData.links.map((link, index) => {
          const sourceNode = validData.nodes.find(n => n.id === link.source);
          const targetNode = validData.nodes.find(n => n.id === link.target);
          
          if (!sourceNode || !targetNode) return null;

          const isHighlight = selectedNode && 
            (link.source === selectedNode || link.target === selectedNode);

          return (
            <Edge
              key={`edge-${index}`}
              start={sourceNode.position}
              end={targetNode.position}
              value={link.value}
              isHighlighted={!!isHighlight}
              dimmed={!!selectedNode && !isHighlight}
              maxThickness={4}
              startNodeType={sourceNode.type}
              endNodeType={targetNode.type}
              startNodeScale={1}
              endNodeScale={1}
            />
          );
        })}

        {/* Render nodes */}
        {validData.nodes.map(node => {
          const isHighlighted = selectedNode === node.id || highlightedNodes.has(node.id);
          const dimmed = !!selectedNode && !isHighlighted;

          return (
            <Node
              key={`node-${node.id}`}
              node={node}
              isSelected={selectedNode === node.id}
              onClick={(id, e) => {
                try {
                  onNodeClick(id);
                } catch (error) {
                  handleRenderingError(error as Error);
                }
              }}
              highlightedNodes={highlightedNodes}
              showLabel={shouldShowLabels && renderingMode === 'full'}
              dimmed={dimmed}
              themeHex={themeHex}
              selectedNodeId={selectedNode}
              cameraZoom={cameraZoom}
              isHighlighted={isHighlighted}
              forceShowLabels={shouldShowLabels}
            />
          );
        })}
      </>
    );
  } catch (error) {
    console.error('[SimplifiedSoulNetVisualization] Render error:', error);
    handleRenderingError(error as Error);
    return null;
  }
};

export default SimplifiedSoulNetVisualization;
