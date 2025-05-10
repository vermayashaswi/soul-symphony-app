
import React, { useRef, useEffect, useMemo, useState } from 'react';
import '@/types/three-reference';  // Fixed import path
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

interface SoulNetVisualizationProps {
  data: { nodes: NodeData[]; links: LinkData[] };
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
  themeHex: string;
  isFullScreen?: boolean;
  translatedLabels?: Map<string, string>;
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

// Calculate relative connection strength within connected nodes
function calculateRelativeStrengths(nodeId: string, links: LinkData[]): Map<string, number> {
  // Safety check for invalid inputs
  if (!nodeId || !links || !Array.isArray(links)) return new Map<string, number>();
  
  // Get all links associated with this node
  const nodeLinks = links.filter(link => 
    link && typeof link === 'object' && (link.source === nodeId || link.target === nodeId)
  );
  
  // Find min and max values
  let minValue = Infinity;
  let maxValue = -Infinity;
  
  nodeLinks.forEach(link => {
    if (link.value < minValue) minValue = link.value;
    if (link.value > maxValue) maxValue = link.value;
  });

  // Create normalized strength map
  const strengthMap = new Map<string, number>();
  
  // If all values are the same, use a default value
  if (maxValue === minValue || maxValue - minValue < 0.001) {
    nodeLinks.forEach(link => {
      const connectedNodeId = link.source === nodeId ? link.target : link.source;
      strengthMap.set(connectedNodeId, 0.8); // Higher default value for better visibility
    });
  } else {
    // Normalize values to 0.3-1.0 range for better visibility
    nodeLinks.forEach(link => {
      const connectedNodeId = link.source === nodeId ? link.target : link.source;
      const normalizedValue = 0.3 + (0.7 * (link.value - minValue) / (maxValue - minValue));
      strengthMap.set(connectedNodeId, normalizedValue);
    });
  }
  
  // Log the calculated strengths for debugging
  console.log(`Connection strengths for ${nodeId}:`, Object.fromEntries(strengthMap));
  return strengthMap;
}

// Calculate percentage distribution of connection strengths
function calculateConnectionPercentages(nodeId: string, links: LinkData[]): Map<string, number> {
  // Safety check for invalid inputs
  if (!nodeId || !links || !Array.isArray(links)) return new Map<string, number>();
  
  // Get all links associated with this node
  const nodeLinks = links.filter(link => 
    link && typeof link === 'object' && (link.source === nodeId || link.target === nodeId)
  );
  
  // Calculate total value of all connections
  const totalValue = nodeLinks.reduce((sum, link) => sum + link.value, 0);
  
  if (totalValue === 0) return new Map<string, number>();
  
  // Create percentage map
  const percentageMap = new Map<string, number>();
  
  nodeLinks.forEach(link => {
    const connectedNodeId = link.source === nodeId ? link.target : link.source;
    const percentage = (link.value / totalValue) * 100;
    percentageMap.set(connectedNodeId, percentage);
  });
  
  // Log the calculated percentages for debugging
  console.log(`Connection percentages for ${nodeId}:`, Object.fromEntries(percentageMap));
  return percentageMap;
}

export const SoulNetVisualization: React.FC<SoulNetVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex,
  isFullScreen = false
}) => {
  const { camera, size } = useThree();
  const controlsRef = useRef<any>(null);
  const [cameraZoom, setCameraZoom] = useState<number>(52); // Doubled from 26 to zoom out 2x
  const [forceUpdate, setForceUpdate] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);
  
  console.log("Rendering SoulNetVisualization component with data:", 
    data?.nodes?.length, "nodes and", data?.links?.length, "links, fullscreen:", isFullScreen);
  
  useEffect(() => {
    console.log("SoulNetVisualization mounted");
    return () => {
      console.log("SoulNetVisualization unmounted");
    };
  }, []);
  
  // Ensure data is valid
  const validData = useMemo(() => {
    if (!data || !data.nodes || !Array.isArray(data.nodes) || !data.links || !Array.isArray(data.links)) {
      console.error("Invalid SoulNetVisualization data:", data);
      return {
        nodes: [],
        links: []
      };
    }
    return data;
  }, [data]);
  
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
    // Force a re-render after selection changes to ensure visuals update
    if (selectedNode) {
      console.log(`Selected node: ${selectedNode}`);
      // Force multiple updates to ensure the visual changes apply
      setForceUpdate(prev => prev + 1);
      const timer = setTimeout(() => {
        setForceUpdate(prev => prev + 1);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [selectedNode]);

  useEffect(() => {
    if (camera && validData.nodes?.length > 0 && !isInitialized) {
      console.log("Initializing camera position");
      try {
        const centerX = centerPosition.x;
        const centerY = centerPosition.y;
        camera.position.set(centerX, centerY, 52); // Doubled from 26 to zoom out 2x
        camera.lookAt(centerX, centerY, 0);
        setIsInitialized(true);
      } catch (error) {
        console.error("Error setting camera position:", error);
      }
    }
  }, [camera, validData.nodes, centerPosition, isInitialized]);

  // Track camera zoom with throttling to improve performance
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

  // Memoize connected nodes to prevent unnecessary recalculations
  const highlightedNodes = useMemo(() => {
    if (!selectedNode || !validData || !validData.links) return new Set<string>();
    return getConnectedNodes(selectedNode, validData.links);
  }, [selectedNode, validData?.links]);

  // Calculate relative strength of connections for the selected node
  const connectionStrengths = useMemo(() => {
    if (!selectedNode || !validData || !validData.links) return new Map<string, number>();
    return calculateRelativeStrengths(selectedNode, validData.links);
  }, [selectedNode, validData?.links]);

  // Calculate percentage distribution of connections for the selected node
  const connectionPercentages = useMemo(() => {
    if (!selectedNode || !validData || !validData.links) return new Map<string, number>();
    return calculateConnectionPercentages(selectedNode, validData.links);
  }, [selectedNode, validData?.links]);

  // Adjust controls dampingFactor based on fullscreen mode
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.dampingFactor = isFullScreen ? 0.08 : 0.05;
      
      // Adjust limits for better fullscreen experience
      controlsRef.current.minDistance = isFullScreen ? 8 : 10; // Doubled from 4 and 5
      controlsRef.current.maxDistance = isFullScreen ? 80 : 60; // Doubled from 40 and 30
    }
  }, [isFullScreen]);

  const shouldDim = !!selectedNode;

  // Custom node click handler with debugging
  const handleNodeClick = (id: string, e: any) => {
    console.log(`Node clicked in visualization: ${id}`);
    onNodeClick(id);
  };

  if (!validData || !validData.nodes || !validData.links) {
    console.error("SoulNetVisualization: Data is missing or invalid", validData);
    return null;
  }

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
        minDistance={isFullScreen ? 8 : 10} // Doubled from 4 and 5
        maxDistance={isFullScreen ? 80 : 60} // Doubled from 40 and 30
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
          console.warn(`Invalid link at index ${index}`, link);
          return null;
        }
        
        const sourceNode = validData.nodes.find(n => n && n.id === link.source);
        const targetNode = validData.nodes.find(n => n && n.id === link.target);
        
        if (!sourceNode || !targetNode) {
          console.warn(`Missing source or target node for link: ${link.source} -> ${link.target}`);
          return null;
        }
        
        const isHighlight = selectedNode &&
          (link.source === selectedNode || link.target === selectedNode);
          
        // Get relative strength for this connection if it's highlighted
        let relativeStrength = 0.3; // default lower value
        
        if (isHighlight && selectedNode) {
          const connectedNodeId = link.source === selectedNode ? link.target : link.source;
          // Use higher base value for highlighted connections
          relativeStrength = connectionStrengths.get(connectedNodeId) || 0.7;
        } else {
          // Use original link value, but scaled down for non-highlighted links
          relativeStrength = link.value * 0.5;
        }
        
        // Skip rendering this edge if positions aren't valid
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
          />
        );
      })}
      
      {/* Display nodes */}
      {validData.nodes.map(node => {
        if (!node || typeof node !== 'object' || !node.id) {
          console.warn("Invalid node:", node);
          return null;
        }
        
        const showLabel = !selectedNode || node.id === selectedNode || highlightedNodes.has(node.id);
        const dimmed = shouldDim && !(selectedNode === node.id || highlightedNodes.has(node.id));
        const isHighlighted = selectedNode === node.id || highlightedNodes.has(node.id);
        
        // Calculate connection strength if this is a connected node
        const connectionStrength = selectedNode && highlightedNodes.has(node.id) 
          ? connectionStrengths.get(node.id) || 0.5
          : 0.5;
          
        // Get percentage for this connection if node is highlighted but not selected
        const connectionPercentage = selectedNode && highlightedNodes.has(node.id)
          ? connectionPercentages.get(node.id) || 0
          : 0;
          
        // Determine if we should show the percentage
        const showPercentage = selectedNode !== null && 
                              highlightedNodes.has(node.id) && 
                              node.id !== selectedNode;
        
        // Skip rendering this node if position isn't valid
        if (!Array.isArray(node.position)) {
          console.warn(`Node ${node.id} has invalid position:`, node.position);
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
            connectionStrength={connectionStrength}
            connectionPercentage={connectionPercentage}
            showPercentage={showPercentage}
          />
        );
      })}
    </>
  );
};

export default SoulNetVisualization;
