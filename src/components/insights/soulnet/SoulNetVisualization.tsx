
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Node } from './Node';
import { Edge } from './Edge';

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

export const SoulNetVisualization: React.FC<SoulNetVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex,
}) => {
  const { camera, size } = useThree();
  const controlsRef = useRef<any>(null);
  const [cameraZoom, setCameraZoom] = useState<number>(26);
  
  // Use memoization to prevent recalculation of center position on every render
  const centerPosition = useMemo(() => {
    const nodePositions = data.nodes.map(node => node.position);
    const centerX = nodePositions.reduce((sum, pos) => sum + pos[0], 0) / Math.max(nodePositions.length, 1);
    const centerY = nodePositions.reduce((sum, pos) => sum + pos[1], 0) / Math.max(nodePositions.length, 1);
    const centerZ = 0;
    return [centerX, centerY, centerZ];
  }, [data.nodes]);

  useEffect(() => {
    if (camera && data.nodes.length > 0) {
      const [centerX, centerY] = centerPosition;
      camera.position.set(centerX, centerY, 26);
      camera.lookAt(centerX, centerY, 0);
    }
  }, [camera, data.nodes, centerPosition]);

  // Use a more efficient way to track camera zoom with throttling
  useEffect(() => {
    const updateCameraDistance = () => {
      if (camera) {
        const currentZ = camera.position.z;
        if (Math.abs(currentZ - cameraZoom) > 0.5) {
          setCameraZoom(currentZ);
        }
      }
    };

    // Use less frequent updates to improve performance
    const intervalId = setInterval(updateCameraDistance, 200);
    return () => clearInterval(intervalId);
  }, [camera, cameraZoom]);

  // Memoize connected nodes to prevent unnecessary recalculations
  const highlightedNodes = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    return getConnectedNodes(selectedNode, data.links);
  }, [selectedNode, data.links]);

  const shouldDim = !!selectedNode;

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
        // Use a more efficient event handler
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
          return (
            <Edge
              key={`edge-${index}`}
              start={sourceNode.position}
              end={targetNode.position}
              value={link.value}
              isHighlighted={!!isHighlight}
              dimmed={shouldDim && !isHighlight}
            />
          );
        })
      ), [data.links, data.nodes, selectedNode, shouldDim])}
      
      {/* Memoize nodes to prevent unnecessary rerenders */}
      {useMemo(() => (
        data.nodes.map(node => {
          const showLabel = !selectedNode || node.id === selectedNode || highlightedNodes.has(node.id);
          const dimmed = shouldDim && !(selectedNode === node.id || highlightedNodes.has(node.id));
          return (
            <Node
              key={`node-${node.id}`}
              node={node}
              isSelected={selectedNode === node.id}
              onClick={onNodeClick}
              highlightedNodes={highlightedNodes}
              showLabel={showLabel}
              dimmed={dimmed}
              themeHex={themeHex}
              selectedNodeId={selectedNode}
              cameraZoom={cameraZoom}
            />
          );
        })
      ), [data.nodes, selectedNode, highlightedNodes, shouldDim, themeHex, cameraZoom, onNodeClick])}
    </>
  );
};

