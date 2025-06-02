
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [mounted, setMounted] = useState(false);

  console.log("[SimplifiedSoulNetVisualization] Rendering with data:", {
    nodeCount: data?.nodes?.length || 0,
    linkCount: data?.links?.length || 0,
    selectedNode,
    shouldShowLabels,
    themeHex,
    isInitialized,
    mounted
  });

  // Component mounting state
  useEffect(() => {
    console.log('[SimplifiedSoulNetVisualization] Component mounting');
    setMounted(true);
    
    // Delayed initialization to prevent race conditions
    const initTimer = setTimeout(() => {
      if (data?.nodes?.length > 0) {
        setIsInitialized(true);
        console.log('[SimplifiedSoulNetVisualization] Initialization complete');
      }
    }, 100);

    return () => {
      console.log('[SimplifiedSoulNetVisualization] Component unmounting');
      setMounted(false);
      clearTimeout(initTimer);
    };
  }, []);

  // Validate data early with better error handling
  const validatedData = useMemo(() => {
    try {
      if (!data || !data.nodes || !Array.isArray(data.nodes)) {
        console.warn('[SimplifiedSoulNetVisualization] Invalid or missing nodes data');
        return { nodes: [], links: [] };
      }
      
      if (!data.links || !Array.isArray(data.links)) {
        console.warn('[SimplifiedSoulNetVisualization] Invalid or missing links data');
        return { nodes: data.nodes, links: [] };
      }

      console.log('[SimplifiedSoulNetVisualization] Data validation successful');
      return data;
    } catch (error) {
      console.error('[SimplifiedSoulNetVisualization] Data validation error:', error);
      return { nodes: [], links: [] };
    }
  }, [data]);

  // Don't render until component is properly mounted and initialized
  if (!mounted || !isInitialized || !validatedData.nodes.length) {
    console.log('[SimplifiedSoulNetVisualization] Not ready to render:', {
      mounted,
      isInitialized,
      nodeCount: validatedData.nodes.length
    });
    return null;
  }

  // Track camera zoom for dynamic sizing with error handling
  useEffect(() => {
    if (!camera || !mounted) return;

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
    const interval = setInterval(updateZoom, 200);
    return () => clearInterval(interval);
  }, [camera, mounted]);

  // Get connected nodes for highlighting with validation
  const connectedNodes = useMemo(() => {
    if (!selectedNode || !mounted) return new Set<string>();
    
    try {
      return getConnectedNodes(selectedNode, validatedData.links || []);
    } catch (error) {
      console.warn('[SimplifiedSoulNetVisualization] Error calculating connected nodes:', error);
      return new Set<string>();
    }
  }, [selectedNode, validatedData.links, mounted]);

  // Calculate max edge thickness for proper scaling
  const maxEdgeThickness = useMemo(() => {
    try {
      if (!validatedData.links || !validatedData.links.length) return 1;
      return Math.max(...validatedData.links.map(link => link.value || 0));
    } catch (error) {
      console.warn('[SimplifiedSoulNetVisualization] Error calculating max edge thickness:', error);
      return 1;
    }
  }, [validatedData.links]);

  const shouldShowNodeLabel = useCallback((nodeId: string) => {
    if (!mounted) return false;
    
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
  }, [shouldShowLabels, selectedNode, connectedNodes, mounted]);

  const isNodeHighlighted = useCallback((nodeId: string) => {
    if (!mounted) return false;
    
    try {
      if (!selectedNode) return false;
      return nodeId === selectedNode || connectedNodes.has(nodeId);
    } catch (error) {
      console.warn('[SimplifiedSoulNetVisualization] Error calculating node highlight:', error);
      return false;
    }
  }, [selectedNode, connectedNodes, mounted]);

  const isEdgeHighlighted = useCallback((link: LinkData) => {
    if (!mounted) return false;
    
    try {
      if (!selectedNode || !link) return false;
      return link.source === selectedNode || link.target === selectedNode;
    } catch (error) {
      console.warn('[SimplifiedSoulNetVisualization] Error calculating edge highlight:', error);
      return false;
    }
  }, [selectedNode, mounted]);

  const isEdgeDimmed = useCallback((link: LinkData) => {
    if (!mounted) return false;
    
    try {
      if (!selectedNode || !link) return false;
      return !isEdgeHighlighted(link);
    } catch (error) {
      console.warn('[SimplifiedSoulNetVisualization] Error calculating edge dimming:', error);
      return false;
    }
  }, [selectedNode, isEdgeHighlighted, mounted]);

  console.log('[SimplifiedSoulNetVisualization] Rendering visualization with', validatedData.nodes.length, 'nodes');

  try {
    return (
      <>
        {/* Enhanced Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <pointLight position={[-10, -10, -5]} intensity={0.4} />

        {/* Camera Controls with better configuration */}
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
          enableDamping={true}
          dampingFactor={0.05}
        />

        {/* Main visualization group */}
        <group ref={groupRef}>
          {/* Render edges with enhanced validation and error handling */}
          {validatedData.links && validatedData.links.map((link, index) => {
            if (!link || typeof link !== 'object') {
              console.warn('[SimplifiedSoulNetVisualization] Invalid link at index:', index);
              return null;
            }
            
            const sourceNode = validatedData.nodes.find(n => n && n.id === link.source);
            const targetNode = validatedData.nodes.find(n => n && n.id === link.target);
            
            if (!sourceNode || !targetNode) {
              console.warn('[SimplifiedSoulNetVisualization] Missing nodes for link:', link.source, '->', link.target);
              return null;
            }

            if (!Array.isArray(sourceNode.position) || !Array.isArray(targetNode.position)) {
              console.warn('[SimplifiedSoulNetVisualization] Invalid node positions for link');
              return null;
            }

            try {
              return (
                <Edge
                  key={`edge-${index}-${link.source}-${link.target}`}
                  start={sourceNode.position}
                  end={targetNode.position}
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

          {/* Render nodes with enhanced validation and error handling */}
          {validatedData.nodes && validatedData.nodes.map((node) => {
            if (!node || !node.id || typeof node !== 'object') {
              console.warn('[SimplifiedSoulNetVisualization] Invalid node:', node);
              return null;
            }
            
            if (!Array.isArray(node.position) || node.position.length !== 3) {
              console.warn('[SimplifiedSoulNetVisualization] Invalid position for node:', node.id);
              return null;
            }
            
            try {
              return (
                <group key={`node-group-${node.id}`} position={node.position}>
                  <Node
                    node={node}
                    isSelected={node.id === selectedNode}
                    onClick={(id: string, e: any) => {
                      try {
                        onNodeClick(id);
                      } catch (error) {
                        console.error('[SimplifiedSoulNetVisualization] Error in node click handler:', error);
                      }
                    }}
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
    console.error('[SimplifiedSoulNetVisualization] Fatal error in component render:', error);
    return null;
  }
};

export default SimplifiedSoulNetVisualization;
