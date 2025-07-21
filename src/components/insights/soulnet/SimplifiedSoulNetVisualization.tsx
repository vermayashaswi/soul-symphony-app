
import React, { useState, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useTheme } from '@/hooks/use-theme';
import Node from './Node';
import Edge from './Edge';
import TouchEventHandler from './TouchEventHandler';
import { NodeStateProvider, useNodeState } from './NodeState';

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

const VisualizationContent: React.FC<SimplifiedSoulNetVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex,
  isFullScreen,
  shouldShowLabels,
  getInstantConnectionPercentage = () => 0,
  getInstantTranslation = (id: string) => id,
  getInstantNodeConnections = () => ({ connectedNodes: [], totalStrength: 0 }),
  isInstantReady = false
}) => {
  const [cameraZoom, setCameraZoom] = useState(45);
  const nodeState = useNodeState();
  
  // UPDATED: Use app's theme context
  const { theme, systemTheme } = useTheme();
  const effectiveTheme = theme === 'system' ? systemTheme : theme;

  console.log(`[SimplifiedSoulNetVisualization] ENHANCED TOUCH: Rendering with ${data.nodes.length} nodes, instantReady: ${isInstantReady}`);

  // Use Three.js controls for camera
  useFrame(({ camera }) => {
    const newZoom = camera.position.length();
    if (Math.abs(newZoom - cameraZoom) > 0.1) {
      setCameraZoom(newZoom);
    }
  });

  // Enhanced node click handler for touch events
  const handleNodeTouch = useCallback((nodeId: string) => {
    console.log(`[SimplifiedSoulNetVisualization] ENHANCED TOUCH: Node touch received for ${nodeId}`);
    
    try {
      nodeState.selectNode(nodeId);
      onNodeClick(nodeId);
      console.log(`[SimplifiedSoulNetVisualization] ENHANCED TOUCH: Touch handlers called successfully for ${nodeId}`);
    } catch (error) {
      console.error(`[SimplifiedSoulNetVisualization] ENHANCED TOUCH: Error in touch handler for ${nodeId}:`, error);
    }
  }, [nodeState, onNodeClick]);

  // Handle canvas clear
  const handleCanvasClear = useCallback(() => {
    console.log('[SimplifiedSoulNetVisualization] ENHANCED TOUCH: Canvas cleared - clearing selection');
    nodeState.clearSelection();
    onNodeClick('');
  }, [nodeState, onNodeClick]);

  // Helper function to find node by id
  const findNodeById = useCallback((nodeId: string): NodeData | undefined => {
    return data.nodes.find(node => node.id === nodeId);
  }, [data.nodes]);

  return (
    <>
      {/* ENHANCED: Touch event handler for mobile optimization */}
      <TouchEventHandler
        onNodeSelect={handleNodeTouch}
        nodes={data.nodes}
        enabled={true}
      />
      
      {/* Enhanced ambient lighting */}
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
        onEnd={handleCanvasClear}
      />
      
      {data.nodes.map((node) => {
        const isSelected = nodeState.isNodeSelected(node.id);
        const isHighlighted = nodeState.isNodeHighlighted(node.id);
        const isDimmed = nodeState.isNodeDimmed(node.id);
        
        const connectionPercentage = nodeState.getConnectionPercentage(node.id);
        const showPercentage = connectionPercentage > 0;
        
        console.log(`[SimplifiedSoulNetVisualization] ENHANCED TOUCH: Rendering node ${node.id} - selected: ${isSelected}, highlighted: ${isHighlighted}, dimmed: ${isDimmed}, percentage: ${connectionPercentage}%`);
        
        return (
          <Node
            key={node.id}
            node={node}
            isSelected={isSelected}
            onClick={handleNodeTouch}
            highlightedNodes={nodeState.highlightedNodes}
            showLabel={shouldShowLabels && !isDimmed}
            dimmed={isDimmed}
            themeHex={themeHex}
            selectedNodeId={nodeState.selectedNodeId}
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
          console.warn(`[SimplifiedSoulNetVisualization] ENHANCED TOUCH: Missing node for link: ${link.source} -> ${link.target}`);
          return null;
        }
        
        const isHighlighted = nodeState.selectedNodeId !== null && 
          (nodeState.isNodeHighlighted(link.source) && nodeState.isNodeHighlighted(link.target));
        
        const isDimmed = nodeState.selectedNodeId !== null && 
          (nodeState.isNodeDimmed(link.source) || nodeState.isNodeDimmed(link.target));
        
        console.log(`[SimplifiedSoulNetVisualization] ENHANCED TOUCH: Rendering edge ${link.source} -> ${link.target} - highlighted: ${isHighlighted}, dimmed: ${isDimmed}`);
        
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

export const SimplifiedSoulNetVisualization: React.FC<SimplifiedSoulNetVisualizationProps> = (props) => {
  return (
    <NodeStateProvider 
      graphData={props.data}
      getInstantConnectionPercentage={props.getInstantConnectionPercentage}
      getInstantNodeConnections={props.getInstantNodeConnections}
      isInstantReady={props.isInstantReady}
    >
      <VisualizationContent {...props} />
    </NodeStateProvider>
  );
};

export default SimplifiedSoulNetVisualization;
