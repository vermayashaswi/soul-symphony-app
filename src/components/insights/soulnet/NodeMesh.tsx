
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import '../../../src/types/three-reference';  // Add type reference
import { useFrame } from '@react-three/fiber';

interface NodeMeshProps {
  type: 'entity' | 'emotion';
  scale: number;
  displayColor: string;
  isHighlighted: boolean;
  dimmed: boolean;
  connectionStrength?: number;
  isSelected: boolean;
  onClick: (e: any) => void;
  onPointerDown: (e: any) => void;
  onPointerUp: (e: any) => void;
  onPointerOut: () => void;
  onPointerLeave: () => void;
}

export const NodeMesh: React.FC<NodeMeshProps> = ({
  type,
  scale,
  displayColor,
  isHighlighted,
  dimmed,
  connectionStrength = 0.5,
  isSelected,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerOut,
  onPointerLeave,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Decrease circle and square node sizes
  const Geometry = useMemo(() => 
    type === 'entity'
      ? <sphereGeometry args={[1.25, 32, 32]} /> // Decreased from 2.25 to 1.25 (1x reduction)
      : <boxGeometry args={[2.3, 2.3, 2.3]} />, // Decreased from 2.7 to 2.3 (0.4x reduction)
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

  // Calculate opacity based on highlight state
  // Make highlighted but non-selected nodes 30% opacity (70% transparent)
  // Keep selected node at higher opacity
  const nodeOpacity = useMemo(() => {
    if (isHighlighted) {
      return isSelected ? 0.8 : 0.3; // Selected node is 80% opaque, highlighted nodes are 30% opaque
    }
    return dimmed ? 0.5 : 0.8; // Normal state: dimmed is 50% opaque, regular is 80% opaque
  }, [isHighlighted, isSelected, dimmed]);

  return (
    <mesh
      ref={meshRef}
      scale={[scale, scale, scale]}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerOut={onPointerOut}
      onPointerLeave={onPointerLeave}
      renderOrder={1} // Set a lower render order for the node mesh
    >
      {Geometry}
      <meshStandardMaterial
        color={displayColor}
        transparent={true} // Explicitly enable transparency
        opacity={nodeOpacity}
        emissive={displayColor}
        emissiveIntensity={isHighlighted ? 1.2 : (dimmed ? 0 : 0.1)}
        roughness={0.3}
        metalness={0.4}
        depthWrite={false} // Disable depth writing for proper transparency
      />
    </mesh>
  );
};

export default NodeMesh;
