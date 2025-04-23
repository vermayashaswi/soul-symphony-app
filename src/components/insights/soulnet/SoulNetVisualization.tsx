
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
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

export const SoulNetVisualization: React.FC<SoulNetVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex,
}) => {
  const { camera, size } = useThree();
  const controlsRef = useRef<any>(null);
  const [cameraZoom, setCameraZoom] = useState<number>(26);
  const [cameraUpdateCount, setCameraUpdateCount] = useState(0);

  // Calculate scene center based on node positions
  const sceneCenter = useMemo(() => {
    if (data.nodes.length === 0) return { x: 0, y: 0, z: 0 };
    
    const positions = data.nodes.map(node => node.position);
    const x = positions.reduce((sum, pos) => sum + pos[0], 0) / positions.length;
    const y = positions.reduce((sum, pos) => sum + pos[1], 0) / positions.length;
    const z = positions.reduce((sum, pos) => sum + pos[2], 0) / positions.length;
    
    return { x, y, z };
  }, [data.nodes]);

  // Center camera on initial load
  useEffect(() => {
    if (camera) {
      camera.position.set(sceneCenter.x, sceneCenter.y, 26);
      camera.lookAt(sceneCenter.x, sceneCenter.y, 0);
    }
  }, [camera, sceneCenter]);

  // Throttled camera zoom updates to reduce flickering
  const updateCameraDistance = useCallback(() => {
    if (camera) {
      const z = camera.position.z;
      setCameraZoom(z);
    }
  }, [camera]);

  // Use debounced camera position updates
  useEffect(() => {
    let isMounted = true;
    
    // Initial update
    updateCameraDistance();
    
    // Create debounced update function
    let debounceTimeout: number | null = null;
    
    const throttledUpdate = () => {
      if (!isMounted) return;
      
      // Clear existing timeout
      if (debounceTimeout) {
        window.clearTimeout(debounceTimeout);
      }
      
      // Set new timeout for update
      debounceTimeout = window.setTimeout(() => {
        if (isMounted) {
          updateCameraDistance();
          setCameraUpdateCount(prev => prev + 1);
        }
      }, 100); // Debounce time in ms
    };
    
    // Set up interval for smooth updates
    const intervalId = setInterval(throttledUpdate, 200);
    
    return () => {
      isMounted = false;
      if (debounceTimeout) window.clearTimeout(debounceTimeout);
      clearInterval(intervalId);
    };
  }, [camera, updateCameraDistance]);

  const highlightedNodes = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    return getConnectedNodes(selectedNode, data.links);
  }, [selectedNode, data.links]);

  const shouldDim = !!selectedNode;

  // Memoize camera target to reduce recalculations - Fix type error by using Vector3
  const cameraTarget = useMemo(() => {
    // Create a proper THREE.Vector3 object
    return new THREE.Vector3(sceneCenter.x, sceneCenter.y, 0);
  }, [sceneCenter]);

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
        target={cameraTarget}
        onChange={() => {
          // Use the callback sparingly to avoid frequent updates
          if (camera) {
            requestAnimationFrame(() => {
              updateCameraDistance();
            });
          }
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
