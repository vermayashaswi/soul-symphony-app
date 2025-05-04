
import React from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface EntityNodeProps {
  position: [number, number, number];
  size: number;
  onClick: () => void;
  isHighlighted: boolean;
  themeHex: string;
}

const EntityNode: React.FC<EntityNodeProps> = ({ position, size, onClick, isHighlighted, themeHex }) => {
  const hoverRef = React.useRef<THREE.Mesh>(null!);
  
  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255,
        }
      : { r: 0.5, g: 0.5, b: 0.5 };
  };

  // Convert hex color to RGB for Three.js
  const themeColor = hexToRgb(themeHex);
  
  // Create a glowing effect for highlighted nodes
  const glowIntensity = isHighlighted ? 0.6 : 0.3;
  const opacity = isHighlighted ? 0.9 : 0.7;
  const nodeScale = isHighlighted ? size * 1.1 : size;
  
  return (
    <mesh
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      ref={hoverRef}
      scale={nodeScale}
    >
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial
        color={new THREE.Color(themeColor.r, themeColor.g, themeColor.b)}
        transparent
        opacity={opacity}
        emissive={new THREE.Color(themeColor.r, themeColor.g, themeColor.b)}
        emissiveIntensity={glowIntensity}
      />
    </mesh>
  );
};

export default EntityNode;
