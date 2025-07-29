import React, { useState, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useTheme } from '@/hooks/use-theme';
import Node from './Node';
import Edge from './Edge';

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
  data: { nodes: NodeData[], links: LinkData[] };
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
  themeHex: string;
  isFullScreen: boolean;
  shouldShowLabels: boolean;
}

export const SimplifiedSoulNetVisualization: React.FC<SimplifiedSoulNetVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex,
  isFullScreen,
  shouldShowLabels
}) => {
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [dimmedNodes, setDimmedNodes] = useState<Set<string>>(new Set());
  const [cameraZoom, setCameraZoom] = useState(45);
  
  const { theme, systemTheme } = useTheme();
  const effectiveTheme = theme === 'system' ? systemTheme : theme;

  // Use Three.js controls for camera
  useFrame(({ camera }) => {
    const newZoom = camera.position.length();
    if (Math.abs(newZoom - cameraZoom) > 0.1) {
      setCameraZoom(newZoom);
    }
  });

  const handleNodeClick = useCallback((node: NodeData) => {
    if (navigator && navigator.vibrate) {
      navigator.vibrate(50);
    }
    onNodeClick(node.id);
  }, [onNodeClick]);

  useEffect(() => {
    if (!selectedNode) {
      setHighlightedNodes(new Set());
      setDimmedNodes(new Set());
      return;
    }

    const connectedNodes = new Set<string>();
    
    data.links.forEach(link => {
      if (link.source === selectedNode) {
        connectedNodes.add(link.target);
      } else if (link.target === selectedNode) {
        connectedNodes.add(link.source);
      }
    });

    setHighlightedNodes(connectedNodes);

    // Dim nodes that are not connected to the selected node
    const allNodeIds = new Set(data.nodes.map(node => node.id));
    const dimmed = new Set<string>();
    allNodeIds.forEach(id => {
      if (!connectedNodes.has(id) && id !== selectedNode) {
        dimmed.add(id);
      }
    });
    setDimmedNodes(dimmed);
  }, [selectedNode, data.links, data.nodes]);

  // Helper function to find node by id
  const findNodeById = useCallback((nodeId: string): NodeData | undefined => {
    return data.nodes.find(node => node.id === nodeId);
  }, [data.nodes]);

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 10, 5]} intensity={1.2} />
      <OrbitControls 
        enablePan={true} 
        enableZoom={true} 
        enableRotate={true}
        minDistance={15}
        maxDistance={120}
        enableDamping={true}
        dampingFactor={0.05}
      />
      
      {data.nodes.map((node) => {
        const isSelected = selectedNode === node.id;
        const isHighlighted = highlightedNodes.has(node.id);
        const isDimmed = dimmedNodes.has(node.id);

        return (
          <Node
            key={node.id}
            node={node}
            isSelected={isSelected}
            onClick={handleNodeClick}
            highlightedNodes={highlightedNodes}
            showLabel={shouldShowLabels}
            dimmed={isDimmed}
            themeHex={themeHex}
            selectedNodeId={selectedNode}
            cameraZoom={cameraZoom}
            isHighlighted={isHighlighted}
            theme={effectiveTheme}
          />
        );
      })}
      
      {data.links.map((link, index) => {
        const sourceNode = findNodeById(link.source);
        const targetNode = findNodeById(link.target);
        
        if (!sourceNode || !targetNode) {
          return null;
        }
        
        const connectsToSelected = selectedNode !== null && 
          (link.source === selectedNode || link.target === selectedNode);
        const bothNodesHighlighted = highlightedNodes.has(link.source) && highlightedNodes.has(link.target);
        const isHighlighted = connectsToSelected || bothNodesHighlighted;
        
        const isDimmed = selectedNode !== null && 
          dimmedNodes.has(link.source) && dimmedNodes.has(link.target);
        
        return (
          <Edge
            key={`${link.source}-${link.target}-${index}`}
            start={sourceNode.position}
            end={targetNode.position}
            value={link.value}
            isHighlighted={isHighlighted}
            dimmed={isDimmed}
            startNodeType={sourceNode.type}
            endNodeType={targetNode.type}
          />
        );
      })}
    </>
  );
};

export default SimplifiedSoulNetVisualization;