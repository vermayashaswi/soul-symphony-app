import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import '@/types/three-reference';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import Node from './Node';
import Edge from './Edge';
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

function getConnectedNodes(nodeId: string, links: LinkData[]): Set<string> {
  if (!nodeId || !links || !Array.isArray(links)) return new Set<string>();
  
  const connected = new Set<string>();
  links.forEach(link => {
    if (!link || typeof link !== 'object') return;
    
    if (link.source === nodeId) connected.add(link.target);
    if (link.target === nodeId) connected.add(link.source);
  });
  return connected;
}

export const SimplifiedSoulNetVisualization: React.FC<SimplifiedSoulNetVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex,
  isFullScreen = false,
  shouldShowLabels = true
}) => {
  const controlsRef = useRef<any>(null);
  const groupRef = useRef<THREE.Group>(null);
  const { camera, size } = useThree();
  const [cameraZoom, setCameraZoom] = useState(45);

  console.log("[SimplifiedSoulNetVisualization] Rendering with data:", {
    nodeCount: data?.nodes?.length || 0,
    linkCount: data?.links?.length || 0,
    selectedNode,
    shouldShowLabels,
    themeHex
  });

  // Validate data early
  if (!data || !data.nodes || !Array.isArray(data.nodes)) {
    console.warn('[SimplifiedSoulNetVisualization] Invalid data provided');
    return null;
  }

  // Track camera zoom for dynamic sizing
  useEffect(() => {
    const updateZoom = () => {
      try {
        if (camera && 'position' in camera) {
          const distance = camera.position.length();
          setCameraZoom(distance);
        }
      } catch (error) {
        console.warn('[SimplifiedSoulNetVisualization] Error updating zoom:', error);
      }
    };

    updateZoom();
    const interval = setInterval(updateZoom, 100);
    return () => clearInterval(interval);
  }, [camera]);

  // Get connected nodes for highlighting with validation
  const connectedNodes = useMemo(() => {
    try {
      if (!selectedNode) return new Set<string>();
      return getConnectedNodes(selectedNode, data.links || []);
    } catch (error) {
      console.warn('[SimplifiedSoulNetVisualization] Error calculating connected nodes:', error);
      return new Set<string>();
    }
  }, [selectedNode, data.links]);

  // Calculate max edge thickness for proper scaling
  const maxEdgeThickness = useMemo(() => {
    try {
      if (!data.links || !data.links.length) return 1;
      return Math.max(...data.links.map(link => link.value || 0));
    } catch (error) {
      console.warn('[SimplifiedSoulNetVisualization] Error calculating max edge thickness:', error);
      return 1;
    }
  }, [data.links]);

  const shouldShowNodeLabel = useCallback((nodeId: string) => {
    try {
      if (!shouldShowLabels) return false;
      if (selectedNode) {
        return nodeId === selectedNode || connectedNodes.has(nodeId);
      }
      return true;
    } catch (error) {
      console.warn('[SimplifiedSoulNetVisualization] Error calculating label visibility:', error);
      return false;
    }
  }, [shouldShowLabels, selectedNode, connectedNodes]);

  const isNodeHighlighted = useCallback((nodeId: string) => {
    try {
      if (!selectedNode) return false;
      return nodeId === selectedNode || connectedNodes.has(nodeId);
    } catch (error) {
      console.warn('[SimplifiedSoulNetVisualization] Error calculating node highlight:', error);
      return false;
    }
  }, [selectedNode, connectedNodes]);

  const isEdgeHighlighted = useCallback((link: LinkData) => {
    try {
      if (!selectedNode || !link) return false;
      return link.source === selectedNode || link.target === selectedNode;
    } catch (error) {
      console.warn('[SimplifiedSoulNetVisualization] Error calculating edge highlight:', error);
      return false;
    }
  }, [selectedNode]);

  const isEdgeDimmed = useCallback((link: LinkData) => {
    try {
      if (!selectedNode || !link) return false;
      return !isEdgeHighlighted(link);
    } catch (error) {
      console.warn('[SimplifiedSoulNetVisualization] Error calculating edge dimming:', error);
      return false;
    }
  }, [selectedNode, isEdgeHighlighted]);

  try {
    return (
      <>
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <pointLight position={[-10, -10, -5]} intensity={0.4} />

        {/* Camera Controls */}
        <OrbitControls
          ref={controlsRef}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          zoomSpeed={0.6}
          rotateSpeed={0.4}
          panSpeed={0.8}
          minDistance={15}
          maxDistance={100}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
        />

        {/* Main visualization group */}
        <group ref={groupRef}>
          {/* Render edges with validation */}
          {data.links && data.links.map((link, index) => {
            if (!link) return null;
            
            const sourceNode = data.nodes.find(n => n && n.id === link.source);
            const targetNode = data.nodes.find(n => n && n.id === link.target);
            
            if (!sourceNode || !targetNode) return null;

            try {
              return (
                <Edge
                  key={`edge-${index}-${link.source}-${link.target}`}
                  start={sourceNode.position || [0, 0, 0]}
                  end={targetNode.position || [0, 0, 0]}
                  value={link.value || 0}
                  isHighlighted={isEdgeHighlighted(link)}
                  dimmed={isEdgeDimmed(link)}
                  maxThickness={maxEdgeThickness}
                  startNodeType={sourceNode.type}
                  endNodeType={targetNode.type}
                  startNodeScale={sourceNode.value || 0.5}
                  endNodeScale={targetNode.value || 0.5}
                />
              );
            } catch (error) {
              console.warn('[SimplifiedSoulNetVisualization] Error rendering edge:', error);
              return null;
            }
          })}

          {/* Render nodes with validation */}
          {data.nodes && data.nodes.map((node) => {
            if (!node || !node.id) return null;
            
            try {
              return (
                <group key={`node-group-${node.id}`} position={node.position || [0, 0, 0]}>
                  <Node
                    node={node}
                    isSelected={node.id === selectedNode}
                    onClick={(id: string, e: any) => onNodeClick(id)}
                    highlightedNodes={connectedNodes}
                    showLabel={shouldShowNodeLabel(node.id)}
                    dimmed={selectedNode ? !isNodeHighlighted(node.id) && node.id !== selectedNode : false}
                    themeHex={themeHex || '#3b82f6'}
                    selectedNodeId={selectedNode}
                    cameraZoom={cameraZoom}
                    isHighlighted={isNodeHighlighted(node.id)}
                    forceShowLabels={shouldShowLabels}
                  />
                </group>
              );
            } catch (error) {
              console.warn('[SimplifiedSoulNetVisualization] Error rendering node:', error);
              return null;
            }
          })}
        </group>
      </>
    );
  } catch (error) {
    console.error('[SimplifiedSoulNetVisualization] Fatal error in component:', error);
    return null;
  }
};

export default SimplifiedSoulNetVisualization;
