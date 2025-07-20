
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

  console.log(`[SimplifiedSoulNetVisualization] COORDINATED THEME: Using app theme context - theme: ${theme}, systemTheme: ${systemTheme}, effective: ${effectiveTheme}`);
  console.log(`[SimplifiedSoulNetVisualization] COORDINATED INSTANT: Rendering with ${data.nodes.length} nodes, instantReady: ${isInstantReady}`);

  // Use Three.js controls for camera
  useFrame(({ camera }) => {
    const newZoom = camera.position.length();
    if (Math.abs(newZoom - cameraZoom) > 0.1) {
      setCameraZoom(newZoom);
    }
  });

  // SOUL-NET SELECTION FIX: Enhanced node click handler with debug logging
  const handleNodeClick = useCallback((nodeId: string) => {
    console.log(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Node click received for ${nodeId}`, {
      currentSelectedNode: selectedNode,
      nodeId,
      willToggle: selectedNode === nodeId,
      isInstantReady
    });
    
    try {
      onNodeClick(nodeId);
      console.log(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: onNodeClick called successfully for ${nodeId}`);
    } catch (error) {
      console.error(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Error in onNodeClick for ${nodeId}:`, error);
    }
  }, [selectedNode, onNodeClick, isInstantReady]);

  // ENHANCED: Instant highlighting effect with stronger visual hierarchy
  useEffect(() => {
    console.log(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Selection state changed - selectedNode: ${selectedNode}`);
    
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
        
        console.log(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Using precomputed connections for ${selectedNode}:`, connectionData.connectedNodes);
      } else {
        // Fallback to link traversal
        data.links.forEach(link => {
          if (link.source === selectedNode || link.target === selectedNode) {
            connectedNodes.add(link.source);
            connectedNodes.add(link.target);
          }
        });
        
        console.log(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Using link traversal for ${selectedNode}`);
      }
      
      // ENHANCED: All nodes that are NOT connected become dimmed
      data.nodes.forEach(node => {
        if (!connectedNodes.has(node.id)) {
          allOtherNodes.add(node.id);
        }
      });
      
      console.log(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Setting state - highlighted: ${Array.from(connectedNodes).join(', ')}, dimmed: ${Array.from(allOtherNodes).join(', ')}`);
      
      setHighlightedNodes(connectedNodes);
      setDimmedNodes(allOtherNodes);
      
      console.log(`[SimplifiedSoulNetVisualization] COORDINATED ENHANCED HIERARCHY: Selected ${selectedNode}, highlighting ${connectedNodes.size} nodes, dimming ${allOtherNodes.size} nodes`);
    } else {
      // ENHANCED: When no node is selected, show all nodes normally (no dimming)
      console.log(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Clearing selection - no node selected`);
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
      {/* ENHANCED: Brighter ambient lighting for better visibility of highlighted elements */}
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
        const isHighlighted = highlightedNodes.has(node.id);
        const isDimmed = dimmedNodes.has(node.id);
        
        // COORDINATED INSTANT connection percentage - no loading delay
        const connectionPercentage = selectedNode && isHighlighted && selectedNode !== node.id
          ? getInstantConnectionPercentage(selectedNode, node.id)
          : 0;
        
        const showPercentage = selectedNode !== null && isHighlighted && selectedNode !== node.id && connectionPercentage > 0;
        
        console.log(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Rendering node ${node.id} - highlighted: ${isHighlighted}, dimmed: ${isDimmed}, selected: ${selectedNode === node.id}, percentage: ${connectionPercentage}%`);
        
        return (
          <Node
            key={node.id}
            node={node}
            isSelected={selectedNode === node.id}
            onClick={handleNodeClick}
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
          console.warn(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Missing node for link: ${link.source} -> ${link.target}`);
          return null;
        }
        
        // ENHANCED: Edge is highlighted only if BOTH nodes are highlighted
        const isHighlighted = selectedNode !== null && 
          (highlightedNodes.has(link.source) && highlightedNodes.has(link.target));
        
        // ENHANCED: Edge is dimmed if EITHER node is dimmed
        const isDimmed = selectedNode !== null && 
          (dimmedNodes.has(link.source) || dimmedNodes.has(link.target));
        
        console.log(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Rendering edge ${link.source} -> ${link.target} - highlighted: ${isHighlighted}, dimmed: ${isDimmed}`);
        
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
