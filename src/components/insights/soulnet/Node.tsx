
import React, { useRef, useState, useMemo } from 'react';
import '@/types/three-reference';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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
  onClick: (id: string, event?: any) => void;
  highlightedNodes: Set<string>;
  showLabel?: boolean;
  dimmed?: boolean;
  themeHex: string;
  selectedNodeId: string | null;
  cameraZoom?: number;
  isHighlighted?: boolean;
  connectionStrength?: number;
  connectionPercentage?: number;
  showPercentage?: boolean;
  forceShowLabels?: boolean;
}

const Node: React.FC<NodeProps> = ({
  node,
  isSelected,
  onClick,
  highlightedNodes,
  dimmed = false,
  themeHex,
  selectedNodeId,
  isHighlighted = false,
  connectionStrength = 0.5,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Enhanced scale calculation based on node state
  const scale = useMemo(() => {
    const baseScale = node.type === 'entity' ? 0.7 : 0.55;
    
    if (isSelected) {
      return baseScale * 1.8; // Much larger when selected
    } else if (isHighlighted) {
      return baseScale * (1.2 + connectionStrength * 0.6); // Scale based on connection strength
    } else if (hovered) {
      return baseScale * 1.3;
    } else if (dimmed) {
      return baseScale * 0.6;
    }
    
    return baseScale * (0.8 + node.value * 0.5);
  }, [node.type, node.value, isSelected, isHighlighted, hovered, dimmed, connectionStrength]);

  // Enhanced color calculation with better contrast
  const nodeColor = useMemo(() => {
    const baseHue = node.type === 'entity' ? 200 : 280; // Blue for entities, purple for emotions
    
    if (isSelected) {
      return `hsl(${baseHue}, 90%, 70%)`; // Bright and vibrant when selected
    } else if (isHighlighted) {
      const intensity = 50 + connectionStrength * 30; // Vary intensity based on connection strength
      return `hsl(${baseHue}, 80%, ${intensity}%)`;
    } else if (dimmed) {
      return `hsl(${baseHue}, 20%, 30%)`; // Very muted when dimmed
    } else if (hovered) {
      return `hsl(${baseHue}, 70%, 60%)`;
    }
    
    return `hsl(${baseHue}, 60%, 50%)`; // Default state
  }, [node.type, isSelected, isHighlighted, hovered, dimmed, connectionStrength]);

  // Enhanced opacity calculation
  const opacity = useMemo(() => {
    if (isSelected) return 1.0;
    if (isHighlighted) return 0.9;
    if (dimmed) return 0.3;
    if (hovered) return 0.8;
    return 0.7;
  }, [isSelected, isHighlighted, dimmed, hovered]);

  // Gentle floating animation
  useFrame((state) => {
    if (meshRef.current && !dimmed) {
      const time = state.clock.getElapsedTime();
      const floatOffset = Math.sin(time * 0.5 + node.position[0] * 0.1) * 0.1;
      meshRef.current.position.y = node.position[1] + floatOffset;
      
      // Gentle rotation for selected nodes
      if (isSelected) {
        meshRef.current.rotation.y += 0.01;
      }
    }
  });

  const handleClick = (event: any) => {
    event.stopPropagation();
    onClick(node.id, event);
  };

  // Create sphere geometry manually since Sphere from drei is not available
  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(scale, 32, 32), [scale]);

  return (
    <group position={[node.position[0], node.position[1], node.position[2]]}>
      <mesh
        ref={meshRef}
        geometry={sphereGeometry}
        position={[0, 0, 0]}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={nodeColor}
          transparent={true}
          opacity={opacity}
          emissive={isSelected ? nodeColor : undefined}
          emissiveIntensity={isSelected ? 0.3 : 0}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      
      {/* Enhanced glow effect for important nodes */}
      {(isSelected || isHighlighted) && (
        <mesh
          geometry={new THREE.SphereGeometry(scale * 1.3, 16, 16)}
          position={[0, 0, 0]}
        >
          <meshBasicMaterial
            color={nodeColor}
            transparent={true}
            opacity={isSelected ? 0.2 : 0.1}
            side={THREE.BackSide}
          />
        </mesh>
      )}
    </group>
  );
};

export default Node;
