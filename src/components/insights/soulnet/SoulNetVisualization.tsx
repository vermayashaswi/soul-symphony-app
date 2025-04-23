
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
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const [cameraZoom, setCameraZoom] = useState<number>(26);

  // Update camera position and track zoom changes
  useEffect(() => {
    if (camera) {
      camera.position.set(0, 0, 26);
      camera.lookAt(0, 0, 0);
    }
  }, [camera]);

  // Monitor camera position for zoom changes
  useEffect(() => {
    const updateCameraDistance = () => {
      if (camera) {
        const z = camera.position.z;
        setCameraZoom(z);
      }
    };

    // Initial update
    updateCameraDistance();

    // Setup an interval to check camera position frequently
    const intervalId = setInterval(updateCameraDistance, 100);
    return () => clearInterval(intervalId);
  }, [camera]);

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
        target={[0, 0, 0]}
        onChange={() => {
          if (camera) setCameraZoom(camera.position.z);
        }}
      />
      {data.links.map((link, index) => {
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
      })}
      {data.nodes.map(node => {
        // Only show labels when needed
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
      })}
    </>
  );
};
