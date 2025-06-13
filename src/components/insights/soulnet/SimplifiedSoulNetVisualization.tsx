
import React, { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { SoulNetNode } from './SoulNetNode';
import { SoulNetLink } from './SoulNetLink';
import DirectNodeLabel from './DirectNodeLabel';

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

interface VisualizationProps {
  data: {
    nodes: NodeData[];
    links: LinkData[];
  };
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
  themeHex: string;
  isFullScreen?: boolean;
  shouldShowLabels?: boolean;
  // SIMPLIFIED: Remove complex coordinated functions
  getConnectionPercentage?: (selectedNode: string, targetNode: string) => number;
}

const SimplifiedSoulNetVisualization: React.FC<VisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex,
  isFullScreen = false,
  shouldShowLabels = true,
  getConnectionPercentage
}) => {
  const { camera } = useThree();
  const [cameraZoom, setCameraZoom] = useState(45);
  
  console.log(`[SimplifiedSoulNetVisualization] SIMPLIFIED: Rendering ${data.nodes.length} nodes, ${data.links.length} links`);

  // Track camera zoom
  useFrame(() => {
    const currentZoom = camera.position.length();
    if (Math.abs(currentZoom - cameraZoom) > 0.1) {
      setCameraZoom(currentZoom);
    }
  });

  // Memoize connected nodes for selected node
  const connectedNodeIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    
    const connected = new Set<string>();
    data.links.forEach(link => {
      if (link.source === selectedNode) {
        connected.add(link.target);
      } else if (link.target === selectedNode) {
        connected.add(link.source);
      }
    });
    
    console.log(`[SimplifiedSoulNetVisualization] SIMPLIFIED: Selected ${selectedNode} has ${connected.size} connections`);
    return connected;
  }, [selectedNode, data.links]);

  // Determine effective theme
  const effectiveTheme = useMemo(() => {
    const luminance = parseInt(themeHex.slice(1, 3), 16) * 0.299 +
                     parseInt(themeHex.slice(3, 5), 16) * 0.587 +
                     parseInt(themeHex.slice(5, 7), 16) * 0.114;
    return luminance > 128 ? 'light' : 'dark';
  }, [themeHex]);

  const handleNodeClick = useCallback((id: string) => {
    console.log(`[SimplifiedSoulNetVisualization] SIMPLIFIED: Node clicked: ${id}`);
    onNodeClick(id);
  }, [onNodeClick]);

  return (
    <>
      <OrbitControls 
        enablePan={false}
        minDistance={25}
        maxDistance={80}
        enableDamping={true}
        dampingFactor={0.05}
      />
      
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      
      {/* Render links */}
      {data.links.map((link, index) => {
        const sourceNode = data.nodes.find(n => n.id === link.source);
        const targetNode = data.nodes.find(n => n.id === link.target);
        
        if (!sourceNode || !targetNode) return null;
        
        const isHighlighted = selectedNode === link.source || selectedNode === link.target;
        
        return (
          <SoulNetLink
            key={`link-${index}`}
            start={sourceNode.position}
            end={targetNode.position}
            strength={link.value}
            isHighlighted={isHighlighted}
            themeHex={themeHex}
          />
        );
      })}
      
      {/* Render nodes */}
      {data.nodes.map((node) => {
        const isSelected = selectedNode === node.id;
        const isConnected = connectedNodeIds.has(node.id);
        const isHighlighted = isSelected || isConnected;
        
        return (
          <React.Fragment key={node.id}>
            <SoulNetNode
              id={node.id}
              position={node.position}
              type={node.type}
              isSelected={isSelected}
              isHighlighted={isHighlighted}
              onClick={handleNodeClick}
              themeHex={themeHex}
              shouldShowLabels={shouldShowLabels}
            />
            
            {/* SIMPLIFIED: Direct label rendering without complex coordination */}
            {shouldShowLabels && (
              <DirectNodeLabel
                id={node.id}
                type={node.type}
                position={node.position}
                isHighlighted={isHighlighted}
                isSelected={isSelected}
                shouldShowLabel={true}
                cameraZoom={cameraZoom}
                themeHex={themeHex}
                nodeScale={1}
                connectionPercentage={
                  selectedNode && getConnectionPercentage 
                    ? getConnectionPercentage(selectedNode, node.id)
                    : 0
                }
                showPercentage={isConnected && !!selectedNode}
                effectiveTheme={effectiveTheme}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

export default SimplifiedSoulNetVisualization;
