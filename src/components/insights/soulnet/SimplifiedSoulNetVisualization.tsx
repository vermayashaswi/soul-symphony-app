
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
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  
  console.log("[SimplifiedSoulNetVisualization] Render with data:", data?.nodes?.length || 0, "nodes");

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Validate and clean data with better error handling
  const validData = useMemo(() => {
    try {
      if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
        console.log("[SimplifiedSoulNetVisualization] Invalid data structure, using empty data");
        return { nodes: [], links: [] };
      }
      
      const validNodes = data.nodes.filter(node => {
        if (!node || !node.id) return false;
        if (!Array.isArray(node.position) || node.position.length !== 3) return false;
        if (!node.type || (node.type !== 'entity' && node.type !== 'emotion')) return false;
        return true;
      });
      
      const validLinks = data.links.filter(link => {
        if (!link || !link.source || !link.target) return false;
        if (!validNodes.some(n => n.id === link.source)) return false;
        if (!validNodes.some(n => n.id === link.target)) return false;
        if (typeof link.value !== 'number' || isNaN(link.value)) return false;
        return true;
      });
      
      console.log("[SimplifiedSoulNetVisualization] Valid data:", validNodes.length, "nodes,", validLinks.length, "links");
      return { nodes: validNodes, links: validLinks };
    } catch (error) {
      console.error("[SimplifiedSoulNetVisualization] Error validating data:", error);
      return { nodes: [], links: [] };
    }
  }, [data]);

  // Calculate center position with error handling
  const centerPosition = useMemo(() => {
    try {
      if (validData.nodes.length === 0) return new THREE.Vector3(0, 0, 0);
      
      const avgX = validData.nodes.reduce((sum, node) => sum + (node.position[0] || 0), 0) / validData.nodes.length;
      const avgY = validData.nodes.reduce((sum, node) => sum + (node.position[1] || 0), 0) / validData.nodes.length;
      
      return new THREE.Vector3(avgX, avgY, 0);
    } catch (error) {
      console.error("[SimplifiedSoulNetVisualization] Error calculating center position:", error);
      return new THREE.Vector3(0, 0, 0);
    }
  }, [validData.nodes]);

  // Safe camera initialization
  useEffect(() => {
    if (!camera || !mountedRef.current) return;

    try {
      console.log("[SimplifiedSoulNetVisualization] Initializing camera");
      
      const targetZ = isFullScreen ? 40 : 45;
      camera.position.set(centerPosition.x, centerPosition.y, targetZ);
      camera.lookAt(centerPosition.x, centerPosition.y, 0);
      camera.updateProjectionMatrix();
      
      setIsInitialized(true);
      setCameraZoom(targetZ);
      
      console.log("[SimplifiedSoulNetVisualization] Camera initialized at position:", camera.position);
    } catch (error) {
      console.error("[SimplifiedSoulNetVisualization] Error initializing camera:", error);
    }
  }, [camera, centerPosition, isFullScreen]);

  // Safe camera zoom tracking
  useFrame(() => {
    if (!camera || !isInitialized || !mountedRef.current) return;
    
    try {
      const currentZ = camera.position.z;
      if (Math.abs(currentZ - cameraZoom) > 1) {
        setCameraZoom(currentZ);
      }
    } catch (error) {
      console.warn("[SimplifiedSoulNetVisualization] Error in frame update:", error);
    }
  });

  // Calculate highlighted nodes with error handling
  const highlightedNodes = useMemo(() => {
    try {
      if (!selectedNode || !validData.links) return new Set<string>();
      
      const connected = new Set<string>();
      validData.links.forEach(link => {
        if (!link) return;
        if (link.source === selectedNode) connected.add(link.target);
        if (link.target === selectedNode) connected.add(link.source);
      });
      
      return connected;
    } catch (error) {
      console.error("[SimplifiedSoulNetVisualization] Error calculating highlighted nodes:", error);
      return new Set<string>();
    }
  }, [selectedNode, validData.links]);

  // Handle node clicks with error handling
  const handleNodeClick = useCallback((id: string) => {
    try {
      console.log("[SimplifiedSoulNetVisualization] Node clicked:", id);
      if (typeof onNodeClick === 'function') {
        onNodeClick(id);
      }
    } catch (error) {
      console.error("[SimplifiedSoulNetVisualization] Error handling node click:", error);
    }
  }, [onNodeClick]);

  // Get text overlay items with error handling
  const textOverlayItems = useSimpleTextItems({
    nodes: validData.nodes,
    selectedNode,
    highlightedNodes,
    theme: theme || 'light',
    cameraZoom,
    shouldShowLabels: shouldShowLabels && isInitialized
  });

  // Render with comprehensive error boundaries
  console.log("[SimplifiedSoulNetVisualization] Rendering 3D scene with", validData.nodes.length, "nodes");
  
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

      {/* Render edges with error handling */}
      {validData.links.map((link, index) => {
        try {
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
        } catch (error) {
          console.warn("[SimplifiedSoulNetVisualization] Error rendering edge:", error);
          return null;
        }
      })}

      {/* Render nodes with error handling */}
      {validData.nodes.map(node => {
        try {
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
        } catch (error) {
          console.warn("[SimplifiedSoulNetVisualization] Error rendering node:", error);
          return null;
        }
      })}

      {/* HTML Text Overlay - render when initialized */}
      {isInitialized && (
        <HtmlTextOverlay textItems={textOverlayItems} />
      )}
    </>
  );
};

export default SimplifiedSoulNetVisualization;
