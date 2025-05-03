
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface NodeMeshProps {
  type: 'entity' | 'emotion';
  scale: number;
  displayColor?: string;
  isHighlighted: boolean;
  dimmed: boolean;
  connectionStrength?: number;
  isSelected: boolean;
  onClick: (e: any) => void; // Updated to accept an event parameter
  themeHex?: string;
  onPointerDown?: (e: any) => void;
  onPointerUp?: (e: any) => void;
  onPointerOut?: () => void;
  onPointerLeave?: () => void;
}

export const NodeMesh = React.forwardRef<THREE.Mesh, NodeMeshProps>((
  {
    type,
    scale,
    displayColor,
    isHighlighted,
    dimmed,
    connectionStrength = 0.5,
    isSelected,
    onClick,
    themeHex = '#ffffff',
    onPointerDown,
    onPointerUp,
    onPointerOut,
    onPointerLeave,
  },
  ref
) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const finalRef = ref || meshRef;
  
  // Use themeHex for the color if displayColor is not provided
  const finalColor = displayColor || themeHex;
  
  const Geometry = useMemo(() => 
    type === 'entity'
      ? <sphereGeometry args={[1, 32, 32]} />
      : <boxGeometry args={[1.2, 1.2, 1.2]} />,
    [type]
  );

  useFrame(({ clock }) => {
    try {
      if (!meshRef.current) return;
      
      if (isHighlighted) {
        const pulseIntensity = isSelected ? 0.25 : (connectionStrength * 0.2);
        const pulse = Math.sin(clock.getElapsedTime() * 2.5) * pulseIntensity + 1.1;
        meshRef.current.scale.set(scale * pulse, scale * pulse, scale * pulse);
        
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          const emissiveIntensity = isSelected 
            ? 1.0 + Math.sin(clock.getElapsedTime() * 3) * 0.3
            : 0.7 + (connectionStrength * 0.3) + Math.sin(clock.getElapsedTime() * 3) * 0.2;
          
          meshRef.current.material.emissiveIntensity = emissiveIntensity;
        }
      } else {
        const targetScale = dimmed ? scale * 0.8 : scale;
        meshRef.current.scale.set(targetScale, targetScale, targetScale);
        
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          meshRef.current.material.emissiveIntensity = dimmed ? 0 : 0.1;
        }
      }
    } catch (error) {
      console.error("Error in NodeMesh useFrame:", error);
    }
  });

  return (
    <mesh
      ref={finalRef as React.RefObject<THREE.Mesh>}
      scale={[scale, scale, scale]}
      onClick={onClick} // Pass the onClick handler
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerOut={onPointerOut}
      onPointerLeave={onPointerLeave}
    >
      {Geometry}
      <meshStandardMaterial
        color={finalColor}
        transparent
        opacity={isHighlighted ? 1 : (dimmed ? 0.5 : 0.8)}
        emissive={finalColor}
        emissiveIntensity={isHighlighted ? 1.2 : (dimmed ? 0 : 0.1)}
        roughness={0.3}
        metalness={0.4}
      />
    </mesh>
  );
});

NodeMesh.displayName = 'NodeMesh';

export default NodeMesh;
