
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import SimpleNode from './SimpleNode';
import Edge from './Edge';
import HtmlTextOverlay from './HtmlTextOverlay';
import { useTheme } from '@/hooks/use-theme';
import { useSimpleTextItems } from './SimpleTextService';
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

export const SimplifiedSoulNetVisualization: React.FC<SimplifiedSoulNetVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex,
  isFullScreen = false,
  shouldShowLabels = true
}) => {
  const { camera } = useThree();
  const { theme } = useTheme();
  const controlsRef = useRef<any>(null);
  const [cameraZoom, setCameraZoom] = useState<number>(45);
  const mountedRef = useRef<boolean>(true);
  
  console.log("[SimplifiedSoulNetVisualization] Render with data:", data.nodes.length, "nodes");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Simple data validation
  const validData = useMemo(() => {
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
      return { nodes: [], links: [] };
    }
    
    const validNodes = data.nodes.filter(node => 
      node && node.id && Array.isArray(node.position) && node.position.length === 3
    );
    
    const validLinks = data.links.filter(link => 
      link && link.source && link.target &&
      validNodes.some(n => n.id === link.source) &&
      validNodes.some(n => n.id === link.target)
    );
    
    return { nodes: validNodes, links: validLinks };
  }, [data]);

  // Simple center calculation
  const centerPosition = useMemo(() => {
    if (validData.nodes.length === 0) return new THREE.Vector3(0, 0, 0);
    
    const avgX = validData.nodes.reduce((sum, node) => sum + node.position[0], 0) / validData.nodes.length;
    const avgY = validData.nodes.reduce((sum, node) => sum + node.position[1], 0) / validData.nodes.length;
    
    return new THREE.Vector3(avgX, avgY, 0);
  }, [validData.nodes]);

  // Simple camera initialization
  useEffect(() => {
    if (validData.nodes.length === 0 || !camera || !mountedRef.current) return;
    
    const timer = setTimeout(() => {
      if (mountedRef.current && camera) {
        const targetZ = isFullScreen ? 40 : 45;
        camera.position.set(centerPosition.x, centerPosition.y, targetZ);
        camera.lookAt(centerPosition.x, centerPosition.y, 0);
        camera.updateProjectionMatrix();
        console.log("[SimplifiedSoulNetVisualization] Camera initialized");
      }
    }, 50);
    
    return () => clearTimeout(timer);
  }, [camera, validData.nodes, centerPosition, isFullScreen]);

  // Simple camera zoom tracking
  useFrame(() => {
    if (camera && mountedRef.current) {
      const currentZ = camera.position.z;
      if (Math.abs(currentZ - cameraZoom) > 1) {
        setCameraZoom(currentZ);
      }
    }
  });

  // Simple highlighted nodes calculation
  const highlightedNodes = useMemo(() => {
    if (!selectedNode || !validData.links) return new Set<string>();
    
    const connected = new Set<string>();
    validData.links.forEach(link => {
      if (link.source === selectedNode) connected.add(link.target);
      if (link.target === selectedNode) connected.add(link.source);
    });
    
    return connected;
  }, [selectedNode, validData.links]);

  // Simple node click handler
  const handleNodeClick = useCallback((id: string) => {
    if (typeof onNodeClick === 'function') {
      onNodeClick(id);
    }
  }, [onNodeClick]);

  // Use the simplified text service
  const textOverlayItems = useSimpleTextItems({
    nodes: validData.nodes,
    selectedNode,
    highlightedNodes,
    theme: theme || 'light',
    cameraZoom,
    shouldShowLabels: shouldShowLabels
  });

  if (validData.nodes.length === 0) {
    return (
      <>
        <ambientLight intensity={0.6} />
        <pointLight position={[5, 5, 5]} intensity={0.4} />
      </>
    );
  }

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        minDistance={isFullScreen ? 8 : 10}
        maxDistance={isFullScreen ? 80 : 60}
        target={centerPosition}
      />

      {/* Render edges */}
      {validData.links.map((link, index) => {
        const sourceNode = validData.nodes.find(n => n.id === link.source);
        const targetNode = validData.nodes.find(n => n.id === link.target);
        
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
            dimmed={!!selectedNode && !isHighlight}
            maxThickness={4}
            startNodeType={sourceNode.type}
            endNodeType={targetNode.type}
            startNodeScale={1}
            endNodeScale={1}
          />
        );
      })}

      {/* Render nodes */}
      {validData.nodes.map(node => {
        const isHighlighted = selectedNode === node.id || highlightedNodes.has(node.id);
        const dimmed = !!selectedNode && !isHighlighted;

        return (
          <SimpleNode
            key={`node-${node.id}`}
            node={node}
            isSelected={selectedNode === node.id}
            onClick={handleNodeClick}
            highlightedNodes={highlightedNodes}
            dimmed={dimmed}
            themeHex={themeHex}
            isHighlighted={isHighlighted}
          />
        );
      })}

      {/* Simple HTML Text Overlay */}
      <HtmlTextOverlay textItems={textOverlayItems} />
    </>
  );
};

export default SimplifiedSoulNetVisualization;
