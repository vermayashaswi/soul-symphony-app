
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import '@/types/three-reference';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import Node from './Node';
import Edge from './Edge';
import { useIsMobile } from '@/hooks/use-mobile';

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
  data: {
    nodes: NodeData[];
    links: LinkData[];
  };
  selectedNode: string | null;
  onNodeClick: (id: string, e: any) => void;
  themeHex: string;
  isFullScreen: boolean;
  shouldShowLabels: boolean;
}

const SoulNetVisualization: React.FC<SoulNetVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex,
  isFullScreen,
  shouldShowLabels
}) => {
  const { camera, gl } = useThree();
  const isMobile = useIsMobile();
  const [cameraZoom, setCameraZoom] = useState(isFullScreen ? 40 : 45);
  const lastUpdateRef = useRef<number>(0);
  const performanceRef = useRef({ frameCount: 0, lastCheck: Date.now() });
  
  // Validate input data
  const validatedData = useMemo(() => {
    try {
      const validNodes = (data?.nodes || []).filter(node => 
        node && 
        typeof node.id === 'string' && 
        node.id.length > 0 &&
        (node.type === 'entity' || node.type === 'emotion') &&
        Array.isArray(node.position) &&
        node.position.length === 3 &&
        node.position.every(coord => typeof coord === 'number' && !isNaN(coord))
      );
      
      const validLinks = (data?.links || []).filter(link =>
        link &&
        typeof link.source === 'string' &&
        typeof link.target === 'string' &&
        typeof link.value === 'number' &&
        !isNaN(link.value) &&
        validNodes.some(node => node.id === link.source) &&
        validNodes.some(node => node.id === link.target)
      );
      
      return { nodes: validNodes, links: validLinks };
    } catch (error) {
      console.error('Data validation error:', error);
      return { nodes: [], links: [] };
    }
  }, [data]);

  // Memoized calculations for highlighted nodes and connections
  const { highlightedNodes, connectionData } = useMemo(() => {
    try {
      if (!selectedNode || !validatedData.nodes.length) {
        return { 
          highlightedNodes: new Set<string>(), 
          connectionData: new Map<string, { strength: number; percentage: number }>() 
        };
      }
      
      const highlighted = new Set<string>([selectedNode]);
      const connections = new Map<string, { strength: number; percentage: number }>();
      const connectedLinks = validatedData.links.filter(link => 
        link.source === selectedNode || link.target === selectedNode
      );
      
      // Calculate total connection strength for percentage calculations
      const totalStrength = connectedLinks.reduce((sum, link) => sum + Math.abs(link.value), 0);
      
      connectedLinks.forEach(link => {
        const connectedNodeId = link.source === selectedNode ? link.target : link.source;
        highlighted.add(connectedNodeId);
        
        const strength = Math.abs(link.value);
        const percentage = totalStrength > 0 ? (strength / totalStrength) * 100 : 0;
        
        connections.set(connectedNodeId, {
          strength: Math.max(0, Math.min(1, strength)),
          percentage: Math.round(percentage)
        });
      });
      
      return { highlightedNodes: highlighted, connectionData: connections };
    } catch (error) {
      console.error('Connection calculation error:', error);
      return { 
        highlightedNodes: new Set<string>(), 
        connectionData: new Map<string, { strength: number; percentage: number }>() 
      };
    }
  }, [selectedNode, validatedData]);

  // Performance monitoring
  useFrame(() => {
    try {
      performanceRef.current.frameCount++;
      const now = Date.now();
      
      if (now - performanceRef.current.lastCheck > 5000) {
        const fps = (performanceRef.current.frameCount * 1000) / (now - performanceRef.current.lastCheck);
        if (fps < 30) {
          console.warn(`SoulNet performance warning: ${fps.toFixed(1)} FPS`);
        }
        performanceRef.current.frameCount = 0;
        performanceRef.current.lastCheck = now;
      }
      
      // Throttled camera zoom updates
      if (camera && now - lastUpdateRef.current > 100) {
        const currentZoom = camera.position.length();
        if (Math.abs(currentZoom - cameraZoom) > 0.5) {
          setCameraZoom(currentZoom);
        }
        lastUpdateRef.current = now;
      }
    } catch (error) {
      console.warn('Frame update error:', error);
    }
  });

  // Safe node click handler
  const handleNodeClick = useCallback((nodeId: string, e: any) => {
    try {
      console.log(`SoulNetVisualization: Node clicked: ${nodeId}`);
      onNodeClick(nodeId, e);
    } catch (error) {
      console.error('Node click handler error:', error);
    }
  }, [onNodeClick]);

  // Early return for empty data
  if (!validatedData.nodes.length) {
    console.log('SoulNetVisualization: No valid nodes to render');
    return (
      <group>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          enableDamping={true}
          dampingFactor={0.05}
          minDistance={20}
          maxDistance={100}
          maxPolarAngle={Math.PI}
          minPolarAngle={0}
        />
      </group>
    );
  }

  console.log(`SoulNetVisualization: Rendering ${validatedData.nodes.length} nodes and ${validatedData.links.length} links`);

  return (
    <group>
      {/* Lighting setup */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <pointLight position={[-10, -10, -5]} intensity={0.3} />
      
      {/* Camera controls */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        enableDamping={true}
        dampingFactor={0.05}
        minDistance={20}
        maxDistance={100}
        maxPolarAngle={Math.PI}
        minPolarAngle={0}
      />
      
      {/* Render edges */}
      {validatedData.links.map((link, index) => {
        try {
          const sourceNode = validatedData.nodes.find(n => n.id === link.source);
          const targetNode = validatedData.nodes.find(n => n.id === link.target);
          
          if (!sourceNode || !targetNode) {
            console.warn(`Invalid link: ${link.source} -> ${link.target}`);
            return null;
          }
          
          const isHighlighted = selectedNode && (
            selectedNode === link.source || 
            selectedNode === link.target
          );
          
          return (
            <Edge
              key={`edge-${link.source}-${link.target}-${index}`}
              start={sourceNode.position}
              end={targetNode.position}
              strength={Math.max(0.1, Math.min(1, Math.abs(link.value)))}
              isHighlighted={!!isHighlighted}
              dimmed={!isHighlighted && selectedNode !== null}
            />
          );
        } catch (error) {
          console.warn(`Edge rendering error for link ${index}:`, error);
          return null;
        }
      })}
      
      {/* Render nodes */}
      {validatedData.nodes.map((node) => {
        try {
          const isSelected = selectedNode === node.id;
          const isHighlighted = highlightedNodes.has(node.id);
          const isDimmed = selectedNode !== null && !isHighlighted;
          const connectionInfo = connectionData.get(node.id);
          
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
              connectionStrength={connectionInfo?.strength || 0.5}
              connectionPercentage={connectionInfo?.percentage || 0}
              showPercentage={isHighlighted && !isSelected}
              forceShowLabels={isFullScreen}
            />
          );
        } catch (error) {
          console.warn(`Node rendering error for ${node.id}:`, error);
          return null;
        }
      })}
    </group>
  );
};

export default SoulNetVisualization;
