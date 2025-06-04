
import React, { useRef } from 'react';
import * as THREE from 'three';
import DirectNodeLabel from './DirectNodeLabel';
import NodeMesh from './NodeMesh';

interface NodeProps {
  node: {
    id: string;
    type: 'entity' | 'emotion';
    position: [number, number, number];
    scale: number;
    isHighlighted: boolean;
  };
  isSelected: boolean;
  onClick: (id: string, event: any) => void;
  highlightedNodes: Set<string>;
  showLabel: boolean;
  dimmed: boolean;
  themeHex: string;
  selectedNodeId: string | null;
  cameraZoom: number;
  isHighlighted: boolean;
  connectionPercentage?: number; 
  showPercentage?: boolean;
  forceShowLabels?: boolean;
  translatedText?: string;
  effectiveTheme?: 'light' | 'dark';
  isInstantMode?: boolean;
}

const Node = ({ 
  node, 
  isSelected, 
  onClick, 
  highlightedNodes, 
  showLabel, 
  dimmed, 
  themeHex,
  selectedNodeId,
  cameraZoom,
  isHighlighted,
  connectionPercentage = 0,
  showPercentage = false,
  forceShowLabels = false,
  translatedText,
  effectiveTheme = 'light',
  isInstantMode = false
}: NodeProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const nodeID = node.id;
  
  // Determine if the label should be shown
  const shouldShowLabel = forceShowLabels || showLabel || isSelected || isHighlighted;
  
  const handleClick = (event: any) => {
    if (onClick) {
      event.stopPropagation();
      onClick(nodeID, event);
    }
  };

  return (
    <group>
      {/* Node Mesh */}
      <NodeMesh
        ref={meshRef}
        position={node.position}
        scale={node.scale}
        nodeType={node.type}
        onClick={handleClick}
        isHighlighted={isHighlighted}
        isSelected={isSelected}
        dimmed={dimmed}
        themeHex={themeHex}
      />
      
      {/* Node Label using DirectNodeLabel with Google Translation integration */}
      <DirectNodeLabel
        id={nodeID}
        type={node.type}
        position={node.position}
        isHighlighted={isHighlighted}
        isSelected={isSelected}
        shouldShowLabel={shouldShowLabel}
        cameraZoom={cameraZoom}
        themeHex={themeHex}
        nodeScale={node.scale}
        connectionPercentage={connectionPercentage}
        showPercentage={showPercentage}
        effectiveTheme={effectiveTheme}
        isInstantMode={isInstantMode}
      />
    </group>
  );
};

export default Node;
