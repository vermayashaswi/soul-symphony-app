
import React, { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { SimpleNodeMesh } from './SimpleNodeMesh';
import * as THREE from 'three';

interface NodeData {
  id: string;
  type: 'entity' | 'emotion';
  value: number;
  color: string;
  position: [number, number, number];
}

interface SimpleNodeProps {
  node: NodeData;
  isSelected: boolean;
  onClick: (id: string) => void;
  highlightedNodes: Set<string>;
  dimmed: boolean;
  themeHex: string;
  isHighlighted: boolean;
}

export const SimpleNode: React.FC<SimpleNodeProps> = ({
  node,
  isSelected,
  onClick,
  highlightedNodes,
  dimmed,
  themeHex,
  isHighlighted
}) => {
  const groupRef = useRef<THREE.Group>(null);

  // Simple scale calculation
  const baseScale = node.type === 'entity' ? 0.8 : 0.6;
  const scale = isSelected ? baseScale * 1.3 : (isHighlighted ? baseScale * 1.1 : baseScale);

  // Simple color calculation
  const getNodeColor = () => {
    if (isSelected) return themeHex;
    if (isHighlighted) return node.type === 'entity' ? '#3b82f6' : '#8b5cf6';
    return node.type === 'entity' ? '#6b7280' : '#9ca3af';
  };

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    onClick(node.id);
  }, [node.id, onClick]);

  // Simple animation
  useFrame((state) => {
    if (groupRef.current && isSelected) {
      const time = state.clock.getElapsedTime();
      const pulse = 1 + Math.sin(time * 3) * 0.1;
      groupRef.current.scale.setScalar(scale * pulse);
    } else if (groupRef.current) {
      groupRef.current.scale.setScalar(scale);
    }
  });

  if (!Array.isArray(node.position) || node.position.length !== 3) {
    console.warn(`SimpleNode: Invalid position for node ${node.id}:`, node.position);
    return null;
  }

  return (
    <group ref={groupRef} position={node.position}>
      <SimpleNodeMesh
        type={node.type}
        scale={scale}
        displayColor={getNodeColor()}
        isHighlighted={isHighlighted}
        dimmed={dimmed}
        isSelected={isSelected}
        onClick={handleClick}
      />
    </group>
  );
};

export default SimpleNode;
