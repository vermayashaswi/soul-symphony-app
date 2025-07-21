
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useTheme } from '@/hooks/use-theme';
import Node from './Node';
import Edge from './Edge';
import { NodeSelectionManager } from './NodeSelectionManager';
import ConnectionCalculator from './ConnectionCalculator';

interface NodeData {
  id: string;
  label?: string;
  type: 'entity' | 'emotion';
  value: number;
  color: string;
  position: [number, number, number];
}

interface LinkData {
  source: string;
  target: string;
  value: number;
  strength?: number;
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
  const [cameraZoom, setCameraZoom] = useState(45);
  const { theme, systemTheme } = useTheme();
  const effectiveTheme = theme === 'system' ? systemTheme : theme;

  console.log(`[SimplifiedSoulNetVisualization] Rendering with ${data.nodes.length} nodes, selected: ${selectedNode}, instantReady: ${isInstantReady}`);

  // Track camera zoom
  useFrame(({ camera }) => {
    const newZoom = camera.position.length();
    if (Math.abs(newZoom - cameraZoom) > 0.1) {
      setCameraZoom(newZoom);
    }
  });

  // Helper function to find node by id
  const findNodeById = useCallback((nodeId: string): NodeData | undefined => {
    return data.nodes.find(node => node.id === nodeId);
  }, [data.nodes]);

  // Calculate connection strengths
  const connectionStrengths = useMemo(() => {
    const strengths = new Map<string, number>();
    data.nodes.forEach(node => {
      strengths.set(node.id, 0.5);
    });
    data.links.forEach(link => {
      const strength = link.value || 0.5;
      strengths.set(link.source, Math.max(strengths.get(link.source) || 0, strength));
      strengths.set(link.target, Math.max(strengths.get(link.target) || 0, strength));
    });
    return strengths;
  }, [data.nodes, data.links]);

  // Convert nodes to Three.js format
  const threeNodes = useMemo(() => {
    return data.nodes.map(node => ({
      id: node.id,
      position: new THREE.Vector3(...node.position)
    }));
  }, [data.nodes]);

  // Convert links to include strength
  const linksWithStrength = useMemo(() => {
    return data.links.map(link => ({
      ...link,
      strength: link.value || 0.5
    }));
  }, [data.links]);

  return (
    <NodeSelectionManager
      nodes={threeNodes}
      links={linksWithStrength}
      connectionStrengths={connectionStrengths}
    >
      {({ selectedNodeId, onNodeSelect, onNodeDeselect }) => (
        <ConnectionCalculator selectedNodeId={selectedNodeId} links={data.links}>
          {({ connectedNodes, getConnectionPercentage, getConnectionStrength }) => (
            <>
              {/* Enhanced lighting for better visibility */}
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
                onChange={onNodeDeselect}
              />
              
              {/* Render nodes */}
              {data.nodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const isHighlighted = connectedNodes.has(node.id);
                const isDimmed = selectedNodeId !== null && !connectedNodes.has(node.id);
                
                const connectionPercentage = selectedNodeId && isHighlighted && selectedNodeId !== node.id
                  ? getConnectionPercentage(node.id)
                  : 0;
                
                const connectionStrength = selectedNodeId && isHighlighted
                  ? getConnectionStrength(node.id)
                  : 0.5;
                
                const showPercentage = selectedNodeId !== null && 
                                      isHighlighted && 
                                      selectedNodeId !== node.id && 
                                      connectionPercentage > 0;
                
                console.log(`[SimplifiedSoulNetVisualization] Node ${node.id} - selected: ${isSelected}, highlighted: ${isHighlighted}, dimmed: ${isDimmed}, percentage: ${connectionPercentage}%`);
                
                return (
                  <Node
                    key={node.id}
                    node={{
                      id: node.id,
                      label: node.id,
                      position: new THREE.Vector3(...node.position)
                    }}
                    isSelected={isSelected}
                    onClick={() => onNodeSelect(node.id, new THREE.Vector3(...node.position))}
                    isHighlighted={isHighlighted}
                    isDimmed={isDimmed}
                    connectionPercentage={connectionPercentage}
                    showPercentage={showPercentage}
                    connectionStrength={connectionStrength}
                    showLabel={shouldShowLabels && !isDimmed}
                    themeHex={themeHex}
                    cameraZoom={cameraZoom}
                    effectiveTheme={effectiveTheme}
                    isInstantMode={isInstantReady}
                    getCoordinatedTranslation={getInstantTranslation}
                  />
                );
              })}
              
              {/* Render edges */}
              {data.links.map((link, index) => {
                const sourceNode = findNodeById(link.source);
                const targetNode = findNodeById(link.target);
                
                if (!sourceNode || !targetNode) {
                  console.warn(`[SimplifiedSoulNetVisualization] Missing node for link: ${link.source} -> ${link.target}`);
                  return null;
                }
                
                // Edge is highlighted only if BOTH nodes are connected
                const isHighlighted = selectedNodeId !== null && 
                  (connectedNodes.has(link.source) && connectedNodes.has(link.target));
                
                // Edge is dimmed if EITHER node is dimmed
                const isDimmed = selectedNodeId !== null && 
                  (!connectedNodes.has(link.source) || !connectedNodes.has(link.target));
                
                console.log(`[SimplifiedSoulNetVisualization] Edge ${link.source} -> ${link.target} - highlighted: ${isHighlighted}, dimmed: ${isDimmed}`);
                
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
          )}
        </ConnectionCalculator>
      )}
    </NodeSelectionManager>
  );
};

export default SimplifiedSoulNetVisualization;
