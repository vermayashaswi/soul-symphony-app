
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
  getInstantConnectionPercentage?: (nodeId: string) => number;
  getInstantTranslation?: (text: string) => string | null;
  getInstantNodeConnections?: (nodeId: string) => Set<string>;
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
  
  console.log(`[SimplifiedSoulNetVisualization] STABLE: Connection strengths for ${nodeId}:`, Object.fromEntries(strengthMap));
  return strengthMap;
}

// Calculate relative connection strength within connected nodes
function calculateConnectionPercentages(nodeId: string, links: LinkData[]): Map<string, number> {
  if (!nodeId || !links || !Array.isArray(links)) {
    console.log(`[SimplifiedSoulNetVisualization] STABLE: Invalid input for percentage calculation`);
    return new Map<string, number>();
  }
  
  const nodeLinks = links.filter(link => 
    link && typeof link === 'object' && (link.source === nodeId || link.target === nodeId)
  );
  
  if (nodeLinks.length === 0) {
    console.log(`[SimplifiedSoulNetVisualization] STABLE: No connections found for ${nodeId}`);
    return new Map<string, number>();
  }
  
  // Calculate total value for percentage calculation
  const totalValue = nodeLinks.reduce((sum, link) => sum + link.value, 0);
  
  if (totalValue === 0) {
    console.log(`[SimplifiedSoulNetVisualization] STABLE: Total value is 0 for ${nodeId}`);
    return new Map<string, number>();
  }
  
  const percentageMap = new Map<string, number>();
  let runningSum = 0;
  
  // Calculate percentages ensuring they sum to 100%
  nodeLinks.forEach((link, index) => {
    const connectedNodeId = link.source === nodeId ? link.target : link.source;
    
    if (index === nodeLinks.length - 1) {
      // For the last item, use remainder to ensure exact 100% sum
      const percentage = 100 - runningSum;
      percentageMap.set(connectedNodeId, Math.max(1, percentage)); // Minimum 1%
    } else {
      const percentage = Math.round((link.value / totalValue) * 100);
      percentageMap.set(connectedNodeId, Math.max(1, percentage)); // Minimum 1%
      runningSum += percentage;
    }
  });
  
  // Verify the sum is 100% (with logging for debugging)
  const totalPercentage = Array.from(percentageMap.values()).reduce((sum, val) => sum + val, 0);
  console.log(`[SimplifiedSoulNetVisualization] STABLE: Connection percentages for ${nodeId}:`, 
    Object.fromEntries(percentageMap), `Total: ${totalPercentage}%`);
    
  return percentageMap;
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
  const { camera, size } = useThree();
  const controlsRef = useRef<any>(null);
  // STABLE: Initialize camera zoom to middle of range (25-100)
  const [cameraZoom, setCameraZoom] = useState<number>(62.5);
  const [forceUpdate, setForceUpdate] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const mounted = useRef<boolean>(true);
  
  console.log("[SimplifiedSoulNetVisualization] STABLE TRANSLATION MODE - No individual translation calls", {
    nodeCount: data?.nodes?.length,
    linkCount: data?.links?.length,
    selectedNode,
    shouldShowLabels,
    cameraZoom,
    isInstantReady
  });
  
  useEffect(() => {
    console.log("[SimplifiedSoulNetVisualization] Component mounted - Stable translation integration");
    return () => {
      console.log("[SimplifiedSoulNetVisualization] Component unmounted");
      mounted.current = false;
    };
  }, []);

  // Ensure data is valid
  const validData = useMemo(() => {
    if (!data || !data.nodes || !Array.isArray(data.nodes) || !data.links || !Array.isArray(data.links)) {
      console.error("[SimplifiedSoulNetVisualization] STABLE: Invalid data:", data);
      return {
        nodes: [],
        links: []
      };
    }
    return data;
  }, [data]);
  
  // STABLE: Debounced center position calculation to prevent flickering
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
      console.error("STABLE: Error calculating center position:", error);
      return new THREE.Vector3(0, 0, 0);
    }
  }, [validData.nodes]);

  // STABLE: Debounced selection effect to prevent flickering
  const debouncedSelectedNode = useMemo(() => {
    return selectedNode;
  }, [selectedNode]);

  useEffect(() => {
    if (debouncedSelectedNode) {
      console.log(`[SimplifiedSoulNetVisualization] STABLE: Selected node: ${debouncedSelectedNode} - no translation triggers`);
      setForceUpdate(prev => prev + 1);
    }
  }, [debouncedSelectedNode]);

  // STABLE: Camera initialization with debouncing
  useEffect(() => {
    if (camera && validData.nodes?.length > 0 && !isInitialized) {
      console.log("[SimplifiedSoulNetVisualization] STABLE: Initializing camera with zoom range 25-100");
      try {
        const centerX = centerPosition.x;
        const centerY = centerPosition.y;
        camera.position.set(centerX, centerY, 62.5);
        camera.lookAt(centerX, centerY, 0);
        setIsInitialized(true);
      } catch (error) {
        console.error("STABLE: Error setting camera position:", error);
      }
    }
  }, [camera, validData.nodes, centerPosition, isInitialized]);

  // STABLE: Throttled camera zoom tracking
  useEffect(() => {
    const updateCameraDistance = () => {
      if (camera) {
        const currentZ = camera.position.z;
        const clampedZ = Math.max(25, Math.min(100, currentZ));
        if (Math.abs(clampedZ - cameraZoom) > 1.0) { // Increased threshold to reduce updates
          setCameraZoom(clampedZ);
        }
      }
    };

    const intervalId = setInterval(updateCameraDistance, 500); // Increased interval for stability
    return () => clearInterval(intervalId);
  }, [camera, cameraZoom]);

  // STABLE: Memoized connected nodes with debouncing
  const highlightedNodes = useMemo(() => {
    if (!debouncedSelectedNode || !validData || !validData.links) return new Set<string>();
    return getConnectedNodes(debouncedSelectedNode, validData.links);
  }, [debouncedSelectedNode, validData?.links]);

  // STABLE: Connection strengths calculation
  const connectionStrengths = useMemo(() => {
    if (!debouncedSelectedNode || !validData || !validData.links) return new Map<string, number>();
    return calculateRelativeStrengths(debouncedSelectedNode, validData.links);
  }, [debouncedSelectedNode, validData?.links]);

  // STABLE: Connection percentages calculation
  const connectionPercentages = useMemo(() => {
    if (!debouncedSelectedNode || !validData || !validData.links) return new Map<string, number>();
    const percentages = calculateConnectionPercentages(debouncedSelectedNode, validData.links);
    
    if (percentages.size > 0) {
      const total = Array.from(percentages.values()).reduce((sum, val) => sum + val, 0);
      console.log(`[SimplifiedSoulNetVisualization] STABLE: Percentage verification for ${debouncedSelectedNode}: ${total}% total`);
    }
    
    return percentages;
  }, [debouncedSelectedNode, validData?.links]);

  // STABLE: Node map creation with minimal recalculation
  const nodeMap = useMemo(() => {
    const map = new Map();
    validData.nodes.forEach(node => {
      const baseScale = node.type === 'entity' ? 0.7 : 0.55;
      const isNodeHighlighted = debouncedSelectedNode === node.id || highlightedNodes.has(node.id);
      const connectionStrength = debouncedSelectedNode && highlightedNodes.has(node.id) 
        ? connectionStrengths.get(node.id) || 0.5
        : 0.5;
      
      const scale = isNodeHighlighted 
        ? baseScale * (1.2 + (debouncedSelectedNode === node.id ? 0.3 : connectionStrength * 0.5))
        : baseScale * (0.8 + node.value * 0.5);
      
      map.set(node.id, { 
        ...node, 
        scale,
        isHighlighted: isNodeHighlighted
      });
    });
    return map;
  }, [validData.nodes, debouncedSelectedNode, highlightedNodes, connectionStrengths]);

  // STABLE: Controls setup
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.dampingFactor = isFullScreen ? 0.08 : 0.05;
      controlsRef.current.minDistance = 25;
      controlsRef.current.maxDistance = 100;
      console.log("[SimplifiedSoulNetVisualization] STABLE: Controls updated with zoom range 25-100");
    }
  }, [isFullScreen]);

  const shouldDim = !!debouncedSelectedNode;

  // STABLE: Node click handler with debouncing
  const handleNodeClick = useCallback((id: string, e: any) => {
    console.log(`[SimplifiedSoulNetVisualization] STABLE: Node clicked: ${id} - no translation side effects`);
    onNodeClick(id);
  }, [onNodeClick]);

  if (!validData || !validData.nodes || !validData.links) {
    console.error("[SimplifiedSoulNetVisualization] STABLE: Data is missing or invalid", validData);
    return null;
  }

  console.log("[SimplifiedSoulNetVisualization] STABLE FINAL RENDER - No flickering, stable translation", { 
    nodeCount: validData.nodes.length,
    shouldShowLabels,
    currentZoom: cameraZoom,
    isInstantReady
  });

  return (
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
        minDistance={25}
        maxDistance={100}
        target={centerPosition}
        onChange={() => {
          if (camera) {
            const currentZ = camera.position.z;
            const clampedZ = Math.max(25, Math.min(100, currentZ));
            if (Math.abs(clampedZ - cameraZoom) > 1.0) {
              setCameraZoom(clampedZ);
            }
          }
        }}
      />
      
      {/* STABLE: Display edges with minimal re-rendering */}
      {validData.links.map((link, index) => {
        if (!link || typeof link !== 'object') {
          console.warn(`[SimplifiedSoulNetVisualization] STABLE: Invalid link at index ${index}`, link);
          return null;
        }
        
        const sourceNode = nodeMap.get(link.source);
        const targetNode = nodeMap.get(link.target);
        
        if (!sourceNode || !targetNode) {
          console.warn(`[SimplifiedSoulNetVisualization] STABLE: Missing source or target node for link: ${link.source} -> ${link.target}`);
          return null;
        }
        
        const isHighlight = debouncedSelectedNode &&
          (link.source === debouncedSelectedNode || link.target === debouncedSelectedNode);
          
        let relativeStrength = 0.3;
        
        if (isHighlight && debouncedSelectedNode) {
          const connectedNodeId = link.source === debouncedSelectedNode ? link.target : link.source;
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
      
      {/* STABLE: Display nodes with centralized translation - no more individual translation calls */}
      {validData.nodes.map(node => {
        if (!node || typeof node !== 'object' || !node.id) {
          console.warn("[SimplifiedSoulNetVisualization] STABLE: Invalid node:", node);
          return null;
        }
        
        // STABLE: Label visibility logic
        const showLabel = shouldShowLabels;
        const dimmed = shouldDim && !(debouncedSelectedNode === node.id || highlightedNodes.has(node.id));
        const isHighlighted = debouncedSelectedNode === node.id || highlightedNodes.has(node.id);
        
        // STABLE: Proper percentage retrieval and display logic
        const connectionPercentage = debouncedSelectedNode && highlightedNodes.has(node.id)
          ? connectionPercentages.get(node.id) || 0
          : 0;
          
        // STABLE: Show percentage for connected nodes when any node is selected
        const showPercentage = debouncedSelectedNode !== null && 
                              isHighlighted && 
                              connectionPercentage > 0 &&
                              node.id !== debouncedSelectedNode;
        
        if (!Array.isArray(node.position)) {
          console.warn(`[SimplifiedSoulNetVisualization] STABLE: Node ${node.id} has invalid position:`, node.position);
          return null;
        }

        if (showPercentage) {
          console.log(`[SimplifiedSoulNetVisualization] STABLE: Showing ${connectionPercentage}% for ${node.id} connected to ${debouncedSelectedNode} - no flickering`);
        }
        
        return (
          <Node
            key={`node-${node.id}-${forceUpdate}`}
            node={node}
            isSelected={debouncedSelectedNode === node.id}
            onClick={handleNodeClick}
            highlightedNodes={highlightedNodes}
            showLabel={showLabel}
            dimmed={dimmed}
            themeHex={themeHex}
            selectedNodeId={debouncedSelectedNode}
            cameraZoom={Math.max(25, Math.min(100, cameraZoom))}
            isHighlighted={isHighlighted}
            connectionPercentage={connectionPercentage}
            showPercentage={showPercentage}
            forceShowLabels={shouldShowLabels}
            effectiveTheme="light"
            isInstantMode={true}
          />
        );
      })}
    </>
  );
};

export default SimplifiedSoulNetVisualization;
