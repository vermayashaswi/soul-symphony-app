
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  
  // ENHANCED: Determine effective theme from themeHex instead of useTheme
  const effectiveTheme: 'light' | 'dark' = useMemo(() => {
    // Parse theme from themeHex color value
    if (themeHex === '#000000' || themeHex.toLowerCase().includes('dark')) {
      return 'dark';
    }
    return 'light';
  }, [themeHex]);

  console.log(`[SimplifiedSoulNetVisualization] ENHANCED THEME: Using theme from themeHex: ${themeHex}, effective: ${effectiveTheme}`);
  console.log(`[SimplifiedSoulNetVisualization] ENHANCED INSTANT: Rendering with ${data.nodes.length} nodes, instantReady: ${isInstantReady}`);

  // Use Three.js controls for camera
  useFrame(({ camera }) => {
    const newZoom = camera.position.length();
    if (Math.abs(newZoom - cameraZoom) > 0.1) {
      setCameraZoom(newZoom);
    }
  });

  // FIXED: Node click handler with proper error handling and mobile compatibility
  const handleNodeClick = useCallback((nodeId: string) => {
    console.log(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Node click received for ${nodeId}`, {
      currentSelectedNode: selectedNode,
      nodeId,
      willToggle: selectedNode === nodeId,
      isInstantReady
    });
    
    try {
      // Add haptic feedback for mobile devices
      if (navigator && navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      // Improved error handling and state management
      requestAnimationFrame(() => {
        try {
          onNodeClick(nodeId);
          console.log(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: onNodeClick called successfully for ${nodeId}`);
        } catch (error) {
          console.error(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Error in onNodeClick callback for ${nodeId}:`, error);
          // Prevent app crash by catching callback errors
        }
      });
    } catch (error) {
      console.error(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Error in handleNodeClick for ${nodeId}:`, error);
      // Graceful degradation - try direct call as fallback
      try {
        onNodeClick(nodeId);
      } catch (fallbackError) {
        console.error(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Fallback call also failed for ${nodeId}:`, fallbackError);
      }
    }
  }, [selectedNode, onNodeClick, isInstantReady]);

  // FIXED: Highlighting effect with proper mobile support and instant data
  useEffect(() => {
    console.log(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Selection state changed - selectedNode: ${selectedNode}`);
    
    if (selectedNode) {
      const connectedNodes = new Set<string>();
      const allOtherNodes = new Set<string>();
      
      // Always add the selected node itself
      connectedNodes.add(selectedNode);
      
      // Use instant connection data if available, otherwise fallback to link traversal
      if (isInstantReady && getInstantNodeConnections) {
        try {
          const connectionData = getInstantNodeConnections(selectedNode);
          console.log(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Connection data for ${selectedNode}:`, connectionData);
          
          // Add all connected nodes from precomputed data
          if (connectionData && connectionData.connectedNodes) {
            connectionData.connectedNodes.forEach((nodeId: string) => {
              connectedNodes.add(nodeId);
            });
            console.log(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Using precomputed connections for ${selectedNode}: ${connectionData.connectedNodes.length} connections`);
          } else {
            console.log(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: No connection data found, falling back to link traversal`);
            // Fallback to link traversal if instant data is incomplete
            data.links.forEach(link => {
              if (link.source === selectedNode) {
                connectedNodes.add(link.target);
              } else if (link.target === selectedNode) {
                connectedNodes.add(link.source);
              }
            });
          }
        } catch (error) {
          console.error(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Error getting instant connections, falling back to link traversal:`, error);
          // Fallback to link traversal on error
          data.links.forEach(link => {
            if (link.source === selectedNode) {
              connectedNodes.add(link.target);
            } else if (link.target === selectedNode) {
              connectedNodes.add(link.source);
            }
          });
        }
      } else {
        // Fallback to link traversal
        data.links.forEach(link => {
          if (link.source === selectedNode) {
            connectedNodes.add(link.target);
          } else if (link.target === selectedNode) {
            connectedNodes.add(link.source);
          }
        });
        console.log(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Using link traversal for ${selectedNode}, found ${connectedNodes.size} connected nodes`);
      }
      
      // FIXED: All nodes that are NOT connected become dimmed
      data.nodes.forEach(node => {
        if (!connectedNodes.has(node.id)) {
          allOtherNodes.add(node.id);
        }
      });
      
      console.log(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Setting highlight/dim state - highlighted: ${connectedNodes.size} nodes, dimmed: ${allOtherNodes.size} nodes`);
      
      setHighlightedNodes(connectedNodes);
      setDimmedNodes(allOtherNodes);
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
        
        // FIXED: Correct connection percentage calculation with better error handling
        let connectionPercentage = 0;
        try {
          if (selectedNode && isHighlighted && selectedNode !== node.id && getInstantConnectionPercentage) {
            connectionPercentage = getInstantConnectionPercentage(selectedNode, node.id);
            console.log(`[SimplifiedSoulNetVisualization] SOUL-NET PERCENTAGE FIX: ${selectedNode} -> ${node.id}: ${connectionPercentage}%`);
          }
        } catch (error) {
          console.error(`[SimplifiedSoulNetVisualization] SOUL-NET PERCENTAGE FIX: Error getting percentage for ${selectedNode} -> ${node.id}:`, error);
        }
        
        const showPercentage = selectedNode !== null && isHighlighted && selectedNode !== node.id && connectionPercentage > 0;
        console.log(`[SimplifiedSoulNetVisualization] SOUL-NET PERCENTAGE FIX: ${node.id} showPercentage=${showPercentage}, percentage=${connectionPercentage}`);
        
        return (
          <Node
            key={node.id}
            node={node}
            isSelected={selectedNode === node.id}
            onClick={handleNodeClick}
            highlightedNodes={highlightedNodes}
            showLabel={shouldShowLabels && (isHighlighted || !selectedNode || selectedNode === node.id)} // Show labels for highlighted, selected, or when no selection
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
          console.warn(`[SimplifiedSoulNetVisualization] SOUL-NET SELECTION FIX: Missing node for link: ${link.source} -> ${link.target}`);
          return null;
        }
        
        // FIXED: Edge is highlighted if it connects to the selected node OR both nodes are highlighted
        const connectsToSelected = selectedNode !== null && 
          (link.source === selectedNode || link.target === selectedNode);
        const bothNodesHighlighted = highlightedNodes.has(link.source) && highlightedNodes.has(link.target);
        const isHighlighted = connectsToSelected || bothNodesHighlighted;
        
        // FIXED: Edge is dimmed only if both nodes are dimmed (not connected to selection)
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
