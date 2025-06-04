
import React, { useRef } from 'react';
import * as THREE from 'three';
import DirectNodeLabel from './DirectNodeLabel';
import NodeMesh from './NodeMesh';

interface NodeProps {
  node: {
    id: string;
    type: 'entity' | 'emotion';
    position: [number, number, number];
    value: number;
    color: string;
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
  
  // Calculate scale based on node properties
  const baseScale = node.type === 'entity' ? 0.7 : 0.55;
  const scale = isHighlighted 
    ? baseScale * (1.2 + (isSelected ? 0.3 : 0.5))
    : baseScale * (0.8 + node.value * 0.5);
  
  // Determine if the label should be shown
  const shouldShowLabel = forceShowLabels || showLabel || isSelected || isHighlighted;
  
  const handleClick = (event: any) => {
    if (onClick) {
      event.stopPropagation();
      onClick(nodeID, event);
    }
  };

  return (
    <group position={node.position}>
      {/* Node Mesh */}
      <NodeMesh
        scale={scale}
        nodeType={node.type}
        onClick={handleClick}
        isHighlighted={isHighlighted}
        isSelected={isSelected}
        dimmed={dimmed}
        themeHex={themeHex}
        displayColor={node.color}
        connectionStrength={0.5}
        onPointerDown={() => {}}
        onPointerUp={() => {}}
        onPointerOut={() => {}}
        onPointerLeave={() => {}}
      />
      
      {/* Node Label using DirectNodeLabel with Google Translation integration */}
      <DirectNodeLabel
        id={nodeID}
        type={node.type}
        position={[0, 0, 0]}
        isHighlighted={isHighlighted}
        isSelected={isSelected}
        shouldShowLabel={shouldShowLabel}
        cameraZoom={cameraZoom}
        themeHex={themeHex}
        nodeScale={scale}
        connectionPercentage={connectionPercentage}
        showPercentage={showPercentage}
        effectiveTheme={effectiveTheme}
        isInstantMode={isInstantMode}
      />
    </group>
  );
};

export default Node;
