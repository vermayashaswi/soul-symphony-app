import React, { useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import NodeMesh from './NodeMesh';
import DirectNodeLabel from './DirectNodeLabel';

interface NodeData {
  id: string;
  type: 'entity' | 'emotion';
  value: number;
  color: string;
  position: [number, number, number];
}

interface NodeProps {
  node: NodeData;
  isSelected: boolean;
  onClick: (node: NodeData) => void;
  highlightedNodes: Set<string>;
  showLabel: boolean;
  dimmed: boolean;
  themeHex: string;
  selectedNodeId: string | null;
  cameraZoom: number;
  isHighlighted: boolean;
  theme: 'light' | 'dark';
}

export const Node: React.FC<NodeProps> = ({ 
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
  theme
}) => {
  const groupRef = useRef<THREE.Group>(null);

  const baseNodeScale = useMemo(() => {
    return Math.max(0.8, Math.min(1.5, node.value / 15));
  }, [node.value]);

  const displayColor = useMemo(() => {
    if (dimmed) {
      return theme === 'light' ? '#d1d5db' : '#374151';
    }
    return node.color;
  }, [node.color, dimmed, theme]);

  const shouldShowLabel = useMemo(() => {
    return showLabel && !dimmed;
  }, [showLabel, dimmed]);

  const handleNodeClick = useCallback((event: any) => {
    event.stopPropagation();
    onClick(node);
  }, [onClick, node]);

  const handlePointerDown = useCallback((event: any) => {
    event.stopPropagation();
  }, []);

  return (
    <group 
      ref={groupRef}
      position={node.position}
    >
      <NodeMesh
        type={node.type}
        scale={baseNodeScale}
        color={displayColor}
        isSelected={isSelected}
        isHighlighted={isHighlighted}
        dimmed={dimmed}
        onClick={handleNodeClick}
        onPointerDown={handlePointerDown}
        connectionStrength={0}
      />
      
      {shouldShowLabel && (
        <DirectNodeLabel
          id={node.id}
          type={node.type}
          position={node.position}
          isHighlighted={isHighlighted}
          isSelected={isSelected}
          dimmed={dimmed}
          showLabel={showLabel}
          cameraZoom={cameraZoom}
          theme={theme}
          nodeScale={baseNodeScale}
        />
      )}
    </group>
  );
};

export default Node;