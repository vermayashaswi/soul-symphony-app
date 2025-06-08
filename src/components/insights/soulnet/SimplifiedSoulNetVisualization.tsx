
import React, { useRef, useEffect, useMemo, useState } from 'react';
import '@/types/three-reference';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import Node from './Node';
import Edge from './Edge';
import * as THREE from 'three';
import { SoulNetTranslationTracker } from './SoulNetTranslationTracker';
import { SoulNetTranslationProgress } from './SoulNetTranslationProgress';

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

interface NodeConnectionData {
  connectedNodes: string[];
  totalStrength: number;
  averageStrength: number;
}

interface SimplifiedSoulNetVisualizationProps {
  data: { nodes: NodeData[]; links: LinkData[] };
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
  themeHex: string;
  isFullScreen?: boolean;
  shouldShowLabels?: boolean;
  getInstantConnectionPercentage?: (selectedNode: string, targetNode: string) => number;
  getInstantTranslation?: (nodeId: string) => string;
  getInstantNodeConnections?: (nodeId: string) => NodeConnectionData;
  isInstantReady?: boolean;
}

// Calculate relative connection strength within connected nodes
function calculateRelativeStrengths(nodeId: string, links: LinkData[]): Map<string, number> {
  if (!nodeId || !links || !Array.isArray(links)) return new Map<string, number>();
  
  const nodeLinks = links.filter(link => 
    link && typeof link === 'object' && (link.source === nodeId || link.target === nodeId)
  );
  
  let minValue = Infinity;
  let maxValue = -Infinity;
  
  nodeLinks.forEach(link => {
    if (link.value < minValue) minValue = link.value;
    if (link.value > maxValue) maxValue = link.value;
  });

  const strengthMap = new Map<string, number>();
  
  if (maxValue === minValue || maxValue - minValue < 0.001) {
    nodeLinks.forEach(link => {
      const connectedNodeId = link.source === nodeId ? link.target : link.source;
      strengthMap.set(connectedNodeId, 0.8);
    });
  } else {
    nodeLinks.forEach(link => {
      const connectedNodeId = link.source === nodeId ? link.target : link.source;
      const normalizedValue = 0.3 + (0.7 * (link.value - minValue) / (maxValue - minValue));
      strengthMap.set(connectedNodeId, normalizedValue);
    });
  }
  
  return strengthMap;
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
  shouldShowLabels = true,
  getInstantConnectionPercentage,
  getInstantTranslation,
  getInstantNodeConnections,
  isInstantReady = false
}) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const [cameraZoom, setCameraZoom] = useState<number>(45);
  const [forceUpdate, setForceUpdate] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [translationsReady, setTranslationsReady] = useState(false);
  
  console.log("[SimplifiedSoulNetVisualization] TRANSLATION GATED RENDERING", {
    nodeCount: data?.nodes?.length,
    selectedNode,
    shouldShowLabels,
    translationsReady,
    isInstantReady
  });

  // Ensure data is valid
  const validData = useMemo(() => {
    if (!data || !data.nodes || !Array.isArray(data.nodes) || !data.links || !Array.isArray(data.links)) {
      console.error("[SimplifiedSoulNetVisualization] Invalid data:", data);
      return { nodes: [], links: [] };
    }
    return data;
  }, [data]);

  // Extract node IDs for translation tracking
  const nodeIds = useMemo(() => 
    validData.nodes.map(node => node.id), 
    [validData.nodes]
  );

  // Handle translation completion
  const handleAllTranslated = React.useCallback(() => {
    console.log('[SimplifiedSoulNetVisualization] All translations complete, enabling rendering');
    setTranslationsReady(true);
  }, []);

  // Use memoization to prevent recalculation of center position on every render
  const centerPosition = useMemo(() => {
    if (!validData.nodes || validData.nodes.length === 0) {
      return new THREE.Vector3(0, 0, 0);
    }
    
    try {
      const validNodes = validData.nodes.filter(node => 
        node && node.position && Array.isArray(node.position) && node.position.length === 3
      );
      
      if (validNodes.length === 0) {
        return new THREE.Vector3(0, 0, 0);
      }
      
      const nodePositions = validNodes.map(node => node.position);
      const centerX = nodePositions.reduce((sum, pos) => sum + pos[0], 0) / Math.max(nodePositions.length, 1);
      const centerY = nodePositions.reduce((sum, pos) => sum + pos[1], 0) / Math.max(nodePositions.length, 1);
      const centerZ = 0;
      return new THREE.Vector3(centerX, centerY, centerZ);
    } catch (error) {
      console.error("Error calculating center position:", error);
      return new THREE.Vector3(0, 0, 0);
    }
  }, [validData.nodes]);

  useEffect(() => {
    if (selectedNode) {
      setForceUpdate(prev => prev + 1);
      const timer = setTimeout(() => {
        setForceUpdate(prev => prev + 1);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [selectedNode]);

  // Optimized camera initialization
  useEffect(() => {
    if (camera && validData.nodes?.length > 0 && !isInitialized) {
      console.log("[SimplifiedSoulNetVisualization] Initializing camera position");
      try {
        const centerX = centerPosition.x;
        const centerY = centerPosition.y;
        camera.position.set(centerX, centerY, 45);
        camera.lookAt(centerX, centerY, 0);
        setIsInitialized(true);
      } catch (error) {
        console.error("Error setting camera position:", error);
      }
    }
  }, [camera, validData.nodes, centerPosition, isInitialized]);

  // Track camera zoom with throttling
  useEffect(() => {
    const updateCameraDistance = () => {
      if (camera) {
        const currentZ = camera.position.z;
        if (Math.abs(currentZ - cameraZoom) > 0.5) {
          setCameraZoom(currentZ);
        }
      }
    };

    const intervalId = setInterval(updateCameraDistance, 200);
    return () => clearInterval(intervalId);
  }, [camera, cameraZoom]);

  // Memoize connected nodes
  const highlightedNodes = useMemo(() => {
    if (!selectedNode || !validData || !validData.links) return new Set<string>();
    return getConnectedNodes(selectedNode, validData.links);
  }, [selectedNode, validData?.links]);

  // Calculate relative strength of connections
  const connectionStrengths = useMemo(() => {
    if (!selectedNode || !validData || !validData.links) return new Map<string, number>();
    return calculateRelativeStrengths(selectedNode, validData.links);
  }, [selectedNode, validData?.links]);

  // Create a map for quick node lookup
  const nodeMap = useMemo(() => {
    const map = new Map();
    validData.nodes.forEach(node => {
      const baseScale = node.type === 'entity' ? 0.7 : 0.55;
      const isNodeHighlighted = selectedNode === node.id || highlightedNodes.has(node.id);
      const connectionStrength = selectedNode && highlightedNodes.has(node.id) 
        ? connectionStrengths.get(node.id) || 0.5
        : 0.5;
      
      const scale = isNodeHighlighted 
        ? baseScale * (1.2 + (selectedNode === node.id ? 0.3 : connectionStrength * 0.5))
        : baseScale * (0.8 + node.value * 0.5);
      
      map.set(node.id, { 
        ...node, 
        scale,
        isHighlighted: isNodeHighlighted
      });
    });
    return map;
  }, [validData.nodes, selectedNode, highlightedNodes, connectionStrengths]);

  // Adjust controls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.dampingFactor = isFullScreen ? 0.08 : 0.05;
      controlsRef.current.minDistance = isFullScreen ? 8 : 10;
      controlsRef.current.maxDistance = isFullScreen ? 80 : 60;
    }
  }, [isFullScreen]);

  const shouldDim = !!selectedNode;

  // Custom node click handler
  const handleNodeClick = (id: string, e: any) => {
    console.log(`[SimplifiedSoulNetVisualization] Node clicked: ${id}`);
    onNodeClick(id);
  };

  if (!validData || !validData.nodes || !validData.links) {
    console.error("[SimplifiedSoulNetVisualization] Data is missing or invalid", validData);
    return null;
  }

  // TRANSLATION GATE: Only render visualization when translations are ready or instant mode
  const shouldRender = isInstantReady || translationsReady;

  return (
    <SoulNetTranslationTracker 
      expectedNodes={nodeIds} 
      onAllTranslated={handleAllTranslated}
    >
      <SoulNetTranslationProgress showProgress={!isInstantReady} />
      
      {shouldRender && (
        <>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={0.8} />
          {isFullScreen && (
            <>
              <hemisphereLight intensity={0.3} color="#ffffff" groundColor="#444444" />
              <pointLight position={[-10, -10, -10]} intensity={0.2} />
            </>
          )}
          <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={isFullScreen ? 0.08 : 0.05}
            rotateSpeed={0.5}
            minDistance={isFullScreen ? 8 : 10}
            maxDistance={isFullScreen ? 80 : 60}
            target={centerPosition}
            onChange={() => {
              if (camera) {
                const currentZ = camera.position.z;
                if (Math.abs(currentZ - cameraZoom) > 0.5) {
                  setCameraZoom(currentZ);
                }
              }
            }}
          />
          
          {/* Display edges */}
          {validData.links.map((link, index) => {
            if (!link || typeof link !== 'object') {
              return null;
            }
            
            const sourceNode = nodeMap.get(link.source);
            const targetNode = nodeMap.get(link.target);
            
            if (!sourceNode || !targetNode) {
              return null;
            }
            
            const isHighlight = selectedNode &&
              (link.source === selectedNode || link.target === selectedNode);
              
            let relativeStrength = 0.3;
            
            if (isHighlight && selectedNode) {
              const connectedNodeId = link.source === selectedNode ? link.target : link.source;
              relativeStrength = connectionStrengths.get(connectedNodeId) || 0.7;
            } else {
              relativeStrength = link.value * 0.5;
            }
            
            if (!Array.isArray(sourceNode.position) || !Array.isArray(targetNode.position)) {
              return null;
            }
              
            return (
              <Edge
                key={`edge-${index}-${forceUpdate}`}
                start={sourceNode.position}
                end={targetNode.position}
                value={relativeStrength}
                isHighlighted={!!isHighlight}
                dimmed={shouldDim && !isHighlight}
                maxThickness={isHighlight ? 10 : 4}
                startNodeType={sourceNode.type}
                endNodeType={targetNode.type}
                startNodeScale={sourceNode.scale}
                endNodeScale={targetNode.scale}
              />
            );
          })}
          
          {/* Display nodes with enhanced translation integration */}
          {validData.nodes.map(node => {
            if (!node || typeof node !== 'object' || !node.id) {
              return null;
            }
            
            const showLabel = shouldShowLabels;
            const dimmed = shouldDim && !(selectedNode === node.id || highlightedNodes.has(node.id));
            const isHighlighted = selectedNode === node.id || highlightedNodes.has(node.id);
            
            // Get connection percentage from instant data or calculate fallback
            const connectionPercentage = selectedNode && highlightedNodes.has(node.id) && getInstantConnectionPercentage
              ? getInstantConnectionPercentage(selectedNode, node.id)
              : 0;
              
            const showPercentage = selectedNode !== null && 
                                  isHighlighted && 
                                  connectionPercentage > 0 &&
                                  node.id !== selectedNode;
            
            if (!Array.isArray(node.position)) {
              return null;
            }
            
            return (
              <Node
                key={`node-${node.id}-${forceUpdate}`}
                node={node}
                isSelected={selectedNode === node.id}
                onClick={handleNodeClick}
                highlightedNodes={highlightedNodes}
                showLabel={showLabel}
                dimmed={dimmed}
                themeHex={themeHex}
                selectedNodeId={selectedNode}
                cameraZoom={cameraZoom}
                isHighlighted={isHighlighted}
                connectionPercentage={connectionPercentage}
                showPercentage={showPercentage}
                forceShowLabels={shouldShowLabels}
                effectiveTheme="light"
                isInstantMode={isInstantReady}
                getInstantTranslation={getInstantTranslation}
                nodeId={node.id}
              />
            );
          })}
        </>
      )}
    </SoulNetTranslationTracker>
  );
};

export default SimplifiedSoulNetVisualization;
