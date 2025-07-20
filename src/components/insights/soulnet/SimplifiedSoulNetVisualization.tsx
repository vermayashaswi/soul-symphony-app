
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
  // COORDINATED: Enhanced instant data access functions
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
  
  // UPDATED: Use app's theme context instead of system theme detection
  const { theme, systemTheme } = useTheme();
  const effectiveTheme = theme === 'system' ? systemTheme : theme;

  console.log(`[SimplifiedSoulNetVisualization] ENHANCED VISUAL HIERARCHY: Using app theme context - theme: ${theme}, systemTheme: ${systemTheme}, effective: ${effectiveTheme}`);
  console.log(`[SimplifiedSoulNetVisualization] ENHANCED SELECTION DEBUG: Selected node: ${selectedNode}, nodes: ${data.nodes.length}, instantReady: ${isInstantReady}`);

  // Use Three.js controls for camera
  useFrame(({ camera }) => {
    const newZoom = camera.position.length();
    if (Math.abs(newZoom - cameraZoom) > 0.1) {
      setCameraZoom(newZoom);
    }
  });

  // ENHANCED: Much more dramatic highlighting effect with stronger visual hierarchy
  useEffect(() => {
    console.log(`[SimplifiedSoulNetVisualization] ENHANCED SELECTION EFFECT: Processing selection change for node: ${selectedNode}`);
    
    if (selectedNode) {
      const connectedNodes = new Set<string>();
      const allOtherNodes = new Set<string>();
      
      // Always include the selected node itself
      connectedNodes.add(selectedNode);
      
      // Use instant connection data if available
      if (isInstantReady) {
        const connectionData = getInstantNodeConnections(selectedNode);
        connectionData.connectedNodes.forEach((nodeId: string) => {
          connectedNodes.add(nodeId);
        });
        
        console.log(`[SimplifiedSoulNetVisualization] ENHANCED INSTANT CONNECTIONS: Using precomputed connections for ${selectedNode}:`, connectionData.connectedNodes);
      } else {
        // Fallback to link traversal
        data.links.forEach(link => {
          if (link.source === selectedNode || link.target === selectedNode) {
            connectedNodes.add(link.source);
            connectedNodes.add(link.target);
          }
        });
        
        console.log(`[SimplifiedSoulNetVisualization] ENHANCED FALLBACK CONNECTIONS: Using link traversal for ${selectedNode}`);
      }
      
      // ENHANCED: All nodes that are NOT connected become heavily dimmed
      data.nodes.forEach(node => {
        if (!connectedNodes.has(node.id)) {
          allOtherNodes.add(node.id);
        }
      });
      
      setHighlightedNodes(connectedNodes);
      setDimmedNodes(allOtherNodes);
      
      console.log(`[SimplifiedSoulNetVisualization] ENHANCED DRAMATIC HIERARCHY: Selected ${selectedNode}`);
      console.log(`  - HIGHLIGHTED nodes (${connectedNodes.size}):`, Array.from(connectedNodes));
      console.log(`  - DIMMED nodes (${allOtherNodes.size}):`, Array.from(allOtherNodes));
    } else {
      // ENHANCED: When no node is selected, show all nodes normally (no dimming)
      setHighlightedNodes(new Set());
      setDimmedNodes(new Set());
      console.log(`[SimplifiedSoulNetVisualization] ENHANCED SELECTION CLEARED: All nodes returned to normal state`);
    }
  }, [selectedNode, data.links, data.nodes, isInstantReady, getInstantNodeConnections]);

  // Helper function to find node by id
  const findNodeById = useCallback((nodeId: string): NodeData | undefined => {
    return data.nodes.find(node => node.id === nodeId);
  }, [data.nodes]);

  return (
    <>
      {/* ENHANCED: Much brighter ambient lighting for dramatic highlighting */}
      <ambientLight intensity={1.0} />
      <directionalLight position={[10, 10, 5]} intensity={1.5} />
      <pointLight position={[-10, 10, 10]} intensity={0.8} />
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
        const isSelected = selectedNode === node.id;
        
        // ENHANCED: More dramatic connection percentage calculation
        const connectionPercentage = selectedNode && isHighlighted && selectedNode !== node.id
          ? getInstantConnectionPercentage(selectedNode, node.id)
          : 0;
        
        const showPercentage = selectedNode !== null && isHighlighted && selectedNode !== node.id && connectionPercentage > 0;
        
        // ENHANCED: Detailed debug logging for each node state
        console.log(`[SimplifiedSoulNetVisualization] ENHANCED NODE STATE: ${node.id}`);
        console.log(`  - Selected: ${isSelected}, Highlighted: ${isHighlighted}, Dimmed: ${isDimmed}`);
        console.log(`  - Connection %: ${connectionPercentage}%, Show %: ${showPercentage}`);
        
        return (
          <Node
            key={node.id}
            node={node}
            isSelected={isSelected}
            onClick={onNodeClick}
            highlightedNodes={highlightedNodes}
            showLabel={shouldShowLabels && !isDimmed} // Don't show labels for dimmed nodes
            dimmed={isDimmed}
            themeHex={themeHex}
            selectedNodeId={selectedNode}
            cameraZoom={cameraZoom}
            isHighlighted={isHighlighted}
            connectionPercentage={connectionPercentage}
            showPercentage={showPercentage}
            forceShowLabels={false} // Let the dimming logic control this
            effectiveTheme={effectiveTheme}
            isInstantMode={isInstantReady}
            getCoordinatedTranslation={getInstantTranslation}
          />
        );
      })}
      
      {data.links.map((link, index) => {
        const sourceNode = findNodeById(link.source);
        const targetNode = findNodeById(link.target);
        
        if (!sourceNode || !targetNode) {
          console.warn(`[SimplifiedSoulNetVisualization] ENHANCED EDGE ERROR: Missing node for link: ${link.source} -> ${link.target}`);
          return null;
        }
        
        // ENHANCED: Much more dramatic edge highlighting - only highlight if BOTH nodes are highlighted
        const isHighlighted = selectedNode !== null && 
          (highlightedNodes.has(link.source) && highlightedNodes.has(link.target));
        
        // ENHANCED: Edge is heavily dimmed if EITHER node is dimmed
        const isDimmed = selectedNode !== null && 
          (dimmedNodes.has(link.source) || dimmedNodes.has(link.target));
        
        // ENHANCED: Debug logging for edge states
        if (selectedNode) {
          console.log(`[SimplifiedSoulNetVisualization] ENHANCED EDGE STATE: ${link.source} -> ${link.target}`);
          console.log(`  - Source highlighted: ${highlightedNodes.has(link.source)}, Target highlighted: ${highlightedNodes.has(link.target)}`);
          console.log(`  - Edge highlighted: ${isHighlighted}, Edge dimmed: ${isDimmed}`);
        }
        
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
