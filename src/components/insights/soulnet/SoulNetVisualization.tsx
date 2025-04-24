
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Node } from './Node';
import { Edge } from './Edge';
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
}

function getConnectedNodes(nodeId: string, links: LinkData[]): Set<string> {
  const connected = new Set<string>();
  links.forEach(link => {
    if (link.source === nodeId) connected.add(link.target);
    if (link.target === nodeId) connected.add(link.source);
  });
  return connected;
}

// Calculate relative connection strength within connected nodes
function calculateRelativeStrengths(nodeId: string, links: LinkData[]): Map<string, number> {
  // Get all links associated with this node
  const nodeLinks = links.filter(link => link.source === nodeId || link.target === nodeId);
  
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

export const SoulNetVisualization: React.FC<SoulNetVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex,
}) => {
  const { camera, size } = useThree();
  const controlsRef = useRef<any>(null);
  const [cameraZoom, setCameraZoom] = useState<number>(26);
  const [forceUpdate, setForceUpdate] = useState<number>(0);
  
  // Use memoization to prevent recalculation of center position on every render
  const centerPosition = useMemo(() => {
    const nodePositions = data.nodes.map(node => node.position);
    const centerX = nodePositions.reduce((sum, pos) => sum + pos[0], 0) / Math.max(nodePositions.length, 1);
    const centerY = nodePositions.reduce((sum, pos) => sum + pos[1], 0) / Math.max(nodePositions.length, 1);
    const centerZ = 0;
    return new THREE.Vector3(centerX, centerY, centerZ);
  }, [data.nodes]);

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
    if (camera && data.nodes.length > 0) {
      const centerX = centerPosition.x;
      const centerY = centerPosition.y;
      camera.position.set(centerX, centerY, 26);
      camera.lookAt(centerX, centerY, 0);
    }
  }, [camera, data.nodes, centerPosition]);

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
    if (!selectedNode) return new Set<string>();
    return getConnectedNodes(selectedNode, data.links);
  }, [selectedNode, data.links]);

  // Calculate relative strength of connections for the selected node
  const connectionStrengths = useMemo(() => {
    if (!selectedNode) return new Map<string, number>();
    return calculateRelativeStrengths(selectedNode, data.links);
  }, [selectedNode, data.links]);

  const shouldDim = !!selectedNode;

  // Log selection state changes for debugging
  useEffect(() => {
    console.log("Selection state updated:", {
      selectedNode,
      highlightedNodesCount: highlightedNodes.size,
      highlightedNodes: Array.from(highlightedNodes),
      shouldDim
    });
  }, [selectedNode, highlightedNodes, shouldDim]);

  // Custom node click handler with debugging
  const handleNodeClick = (id: string) => {
    console.log(`Node clicked in visualization: ${id}`);
    onNodeClick(id);
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
      
      {/* Memoize edges to prevent unnecessary rerenders */}
      {useMemo(() => (
        data.links.map((link, index) => {
          const sourceNode = data.nodes.find(n => n.id === link.source);
          const targetNode = data.nodes.find(n => n.id === link.target);
          if (!sourceNode || !targetNode) return null;
          
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
        })
      ), [data.links, data.nodes, selectedNode, shouldDim, connectionStrengths, forceUpdate])}
      
      {/* Memoize nodes to prevent unnecessary rerenders */}
      {useMemo(() => (
        data.nodes.map(node => {
          const showLabel = !selectedNode || node.id === selectedNode || highlightedNodes.has(node.id);
          const dimmed = shouldDim && !(selectedNode === node.id || highlightedNodes.has(node.id));
          const isHighlighted = selectedNode === node.id || highlightedNodes.has(node.id);
          
          // Calculate connection strength if this is a connected node
          const connectionStrength = selectedNode && highlightedNodes.has(node.id) 
            ? connectionStrengths.get(node.id) || 0.5
            : 0.5;
            
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
            />
          );
        })
      ), [data.nodes, selectedNode, highlightedNodes, shouldDim, themeHex, cameraZoom, handleNodeClick, forceUpdate, connectionStrengths])}
    </>
  );
};
