
import React, { useState, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
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
  // NEW: Instant data access functions
  getInstantConnectionPercentage?: (selectedNode: string, targetNode: string) => number;
  getInstantTranslation?: (nodeId: string) => string;
  getInstantNodeConnections?: (nodeId: string) => any;
  isInstantReady?: boolean;
}

export const SimplifiedSoulNetVisualization: React.FC<SimplifiedSoulNetVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex,
  isFullScreen,
  shouldShowLabels,
  getInstantConnectionPercentage = () => 0,
  getInstantTranslation = (id: string) => id,
  getInstantNodeConnections = () => ({ connectedNodes: [], totalStrength: 0, averageStrength: 0 }),
  isInstantReady = false
}) => {
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [dimmedNodes, setDimmedNodes] = useState<Set<string>>(new Set());
  const [cameraZoom, setCameraZoom] = useState(45);
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  console.log(`[SimplifiedSoulNetVisualization] INSTANT MODE: Rendering with ${data.nodes.length} nodes, instantReady: ${isInstantReady}`);

  // Detect user's theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setEffectiveTheme(event.matches ? 'dark' : 'light');
    };

    setEffectiveTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // Use Three.js controls for camera
  useFrame(({ camera }) => {
    const newZoom = camera.position.length();
    if (Math.abs(newZoom - cameraZoom) > 0.1) {
      setCameraZoom(newZoom);
    }
  });

  // INSTANT highlighting effect when a node is selected
  useEffect(() => {
    if (selectedNode) {
      const connectedNodes = new Set<string>();
      const allOtherNodes = new Set<string>();
      
      // Use instant connection data if available
      if (isInstantReady) {
        const connectionData = getInstantNodeConnections(selectedNode);
        connectionData.connectedNodes.forEach((nodeId: string) => {
          connectedNodes.add(nodeId);
        });
        connectedNodes.add(selectedNode); // Include the selected node itself
        
        console.log(`[SimplifiedSoulNetVisualization] INSTANT: Using precomputed connections for ${selectedNode}:`, connectionData.connectedNodes);
      } else {
        // Fallback to link traversal
        data.links.forEach(link => {
          if (link.source === selectedNode || link.target === selectedNode) {
            connectedNodes.add(link.source);
            connectedNodes.add(link.target);
          }
        });
      }
      
      data.nodes.forEach(node => {
        if (!connectedNodes.has(node.id)) {
          allOtherNodes.add(node.id);
        }
      });
      
      setHighlightedNodes(connectedNodes);
      setDimmedNodes(allOtherNodes);
      
      console.log(`[SimplifiedSoulNetVisualization] INSTANT: Selected ${selectedNode}, highlighting ${connectedNodes.size} connected nodes`);
    } else {
      setHighlightedNodes(new Set());
      setDimmedNodes(new Set());
    }
  }, [selectedNode, data.links, data.nodes, isInstantReady, getInstantNodeConnections]);

  // Helper function to find node by id
  const findNodeById = useCallback((nodeId: string): NodeData | undefined => {
    return data.nodes.find(node => node.id === nodeId);
  }, [data.nodes]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
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
        const isHighlighted = highlightedNodes.has(node.id);
        const isDimmed = dimmedNodes.has(node.id);
        
        // INSTANT connection percentage - no loading delay
        const connectionPercentage = selectedNode && isHighlighted && selectedNode !== node.id
          ? getInstantConnectionPercentage(selectedNode, node.id)
          : 0;
        
        const showPercentage = selectedNode !== null && isHighlighted && selectedNode !== node.id && connectionPercentage > 0;
        
        // INSTANT translation - no loading delay
        const translatedText = getInstantTranslation(node.id);
        
        console.log(`[SimplifiedSoulNetVisualization] INSTANT: Node ${node.id} - percentage: ${connectionPercentage}%, translation: "${translatedText}", showPercentage: ${showPercentage}`);
        
        return (
          <Node
            key={node.id}
            node={node}
            isSelected={selectedNode === node.id}
            onClick={onNodeClick}
            highlightedNodes={highlightedNodes}
            showLabel={shouldShowLabels}
            dimmed={isDimmed}
            themeHex={themeHex}
            selectedNodeId={selectedNode}
            cameraZoom={cameraZoom}
            isHighlighted={isHighlighted}
            connectionPercentage={connectionPercentage}
            showPercentage={showPercentage}
            forceShowLabels={shouldShowLabels}
            translatedText={translatedText}
            effectiveTheme={effectiveTheme}
            isInstantMode={isInstantReady}
          />
        );
      })}
      
      {data.links.map((link, index) => {
        const sourceNode = findNodeById(link.source);
        const targetNode = findNodeById(link.target);
        
        if (!sourceNode || !targetNode) {
          console.warn(`[SimplifiedSoulNetVisualization] Missing node for link: ${link.source} -> ${link.target}`);
          return null;
        }
        
        return (
          <Edge
            key={`${link.source}-${link.target}-${index}`}
            start={sourceNode.position}
            end={targetNode.position}
            value={link.value}
            isHighlighted={
              selectedNode !== null && 
              (highlightedNodes.has(link.source) && highlightedNodes.has(link.target))
            }
            dimmed={
              selectedNode !== null && 
              (!highlightedNodes.has(link.source) || !highlightedNodes.has(link.target))
            }
            startNodeType={sourceNode.type}
            endNodeType={targetNode.type}
          />
        );
      })}
    </>
  );
};

export default SimplifiedSoulNetVisualization;
