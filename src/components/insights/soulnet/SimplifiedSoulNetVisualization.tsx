
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
  const [connectionStrengths, setConnectionStrengths] = useState<Map<string, number>>(new Map());
  
  const { theme, systemTheme } = useTheme();
  const effectiveTheme = theme === 'system' ? systemTheme : theme;

  console.log(`[SimplifiedSoulNetVisualization] PHASE 1 FIX: Rendering with ${data.nodes.length} nodes, selectedNode: ${selectedNode}, instantReady: ${isInstantReady}`);

  // Use Three.js controls for camera
  useFrame(({ camera }) => {
    const newZoom = camera.position.length();
    if (Math.abs(newZoom - cameraZoom) > 0.1) {
      setCameraZoom(newZoom);
    }
  });

  // PHASE 1 FIX: Enhanced node click handler with proper selection logic
  const handleNodeClick = useCallback((nodeId: string) => {
    console.log(`[SimplifiedSoulNetVisualization] PHASE 1 FIX: Node click for ${nodeId}`, {
      currentSelectedNode: selectedNode,
      willToggle: selectedNode === nodeId,
      isInstantReady
    });
    
    try {
      // Add haptic feedback for mobile devices
      if (navigator && navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      // Toggle selection: if clicking the same node, deselect it
      const newSelectedNode = selectedNode === nodeId ? null : nodeId;
      onNodeClick(newSelectedNode || nodeId);
      
      console.log(`[SimplifiedSoulNetVisualization] PHASE 1 FIX: Selection changed to ${newSelectedNode || 'none'}`);
    } catch (error) {
      console.error(`[SimplifiedSoulNetVisualization] PHASE 1 FIX: Error in node click:`, error);
    }
  }, [selectedNode, onNodeClick, isInstantReady]);

  // PHASE 1 FIX: Enhanced highlighting effect with proper connection strength calculation
  useEffect(() => {
    console.log(`[SimplifiedSoulNetVisualization] PHASE 1 FIX: Updating highlights for selectedNode: ${selectedNode}`);
    
    if (selectedNode) {
      const connectedNodes = new Set<string>();
      const allOtherNodes = new Set<string>();
      const strengthMap = new Map<string, number>();
      
      // Always add the selected node itself
      connectedNodes.add(selectedNode);
      
      // Use instant connection data if available
      if (isInstantReady && getInstantNodeConnections) {
        const connectionData = getInstantNodeConnections(selectedNode);
        console.log(`[SimplifiedSoulNetVisualization] PHASE 1 FIX: Using instant connection data:`, connectionData);
        
        connectionData.connectedNodes.forEach((nodeId: string) => {
          connectedNodes.add(nodeId);
          // Calculate connection strength based on percentage
          const percentage = getInstantConnectionPercentage(selectedNode, nodeId);
          const strength = Math.max(0.3, Math.min(1.0, percentage / 100));
          strengthMap.set(nodeId, strength);
        });
      } else {
        // Fallback to link traversal with strength calculation
        const nodeLinks = data.links.filter(link => 
          link.source === selectedNode || link.target === selectedNode
        );
        
        // Calculate min/max for normalization
        const linkValues = nodeLinks.map(link => link.value);
        const minValue = Math.min(...linkValues);
        const maxValue = Math.max(...linkValues);
        const range = maxValue - minValue;
        
        nodeLinks.forEach(link => {
          const connectedNodeId = link.source === selectedNode ? link.target : link.source;
          connectedNodes.add(connectedNodeId);
          
          // Normalize strength between 0.3 and 1.0
          const normalizedStrength = range > 0 
            ? 0.3 + (0.7 * (link.value - minValue) / range)
            : 0.5;
          strengthMap.set(connectedNodeId, normalizedStrength);
        });
      }
      
      // All nodes that are NOT connected become dimmed
      data.nodes.forEach(node => {
        if (!connectedNodes.has(node.id)) {
          allOtherNodes.add(node.id);
        }
      });
      
      console.log(`[SimplifiedSoulNetVisualization] PHASE 1 FIX: Highlighted: ${connectedNodes.size} nodes, Dimmed: ${allOtherNodes.size} nodes`);
      
      setHighlightedNodes(connectedNodes);
      setDimmedNodes(allOtherNodes);
      setConnectionStrengths(strengthMap);
    } else {
      // Clear all highlighting when no node is selected
      console.log(`[SimplifiedSoulNetVisualization] PHASE 1 FIX: Clearing all highlights`);
      setHighlightedNodes(new Set());
      setDimmedNodes(new Set());
      setConnectionStrengths(new Map());
    }
  }, [selectedNode, data.links, data.nodes, isInstantReady, getInstantNodeConnections, getInstantConnectionPercentage]);

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
        const isHighlighted = highlightedNodes.has(node.id);
        const isDimmed = dimmedNodes.has(node.id);
        
        // PHASE 1 FIX: Proper connection percentage calculation
        const connectionPercentage = selectedNode && isHighlighted && selectedNode !== node.id
          ? getInstantConnectionPercentage(selectedNode, node.id)
          : 0;
        
        const showPercentage = selectedNode !== null && isHighlighted && selectedNode !== node.id && connectionPercentage > 0;
        
        return (
          <Node
            key={node.id}
            node={node}
            isSelected={selectedNode === node.id}
            onClick={handleNodeClick}
            highlightedNodes={highlightedNodes}
            showLabel={shouldShowLabels && (isHighlighted || !selectedNode)}
            dimmed={isDimmed}
            themeHex={themeHex}
            selectedNodeId={selectedNode}
            cameraZoom={cameraZoom}
            isHighlighted={isHighlighted}
            connectionPercentage={connectionPercentage}
            showPercentage={showPercentage}
            forceShowLabels={false}
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
          console.warn(`[SimplifiedSoulNetVisualization] PHASE 1 FIX: Missing node for link: ${link.source} -> ${link.target}`);
          return null;
        }
        
        // PHASE 1 FIX: Enhanced edge highlighting with connection strength
        const isHighlighted = selectedNode !== null && 
          highlightedNodes.has(link.source) && highlightedNodes.has(link.target);
        
        const isDimmed = selectedNode !== null && 
          (dimmedNodes.has(link.source) || dimmedNodes.has(link.target));
        
        // Calculate edge thickness based on connection strength
        const connectionStrength = selectedNode && isHighlighted 
          ? Math.max(
              connectionStrengths.get(link.source) || 0.5,
              connectionStrengths.get(link.target) || 0.5
            )
          : 0.5;
        
        return (
          <Edge
            key={`${link.source}-${link.target}-${index}`}
            start={sourceNode.position}
            end={targetNode.position}
            value={isHighlighted ? connectionStrength : link.value}
            isHighlighted={isHighlighted}
            dimmed={isDimmed}
            startNodeType={sourceNode.type}
            endNodeType={targetNode.type}
            maxThickness={isHighlighted ? 8 : 4}
          />
        );
      })}
    </>
  );
};

export default SimplifiedSoulNetVisualization;
