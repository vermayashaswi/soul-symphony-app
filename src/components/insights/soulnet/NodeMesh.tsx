
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import '@/types/three-reference';  // Fixed import path
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
  
  // Adjusted node sizes to better match reference image proportions
  const Geometry = useMemo(() => 
    type === 'entity'
      ? <sphereGeometry args={[1.4, 32, 32]} /> // Increased from 1.25 to 1.4 for better visibility
      : <boxGeometry args={[2.1, 2.1, 2.1]} />, // Slightly reduced from 2.3 to 2.1 for better balance
    [type]
  );

  // Fix: Use state for animation instead of relying on clock from RootState
  useFrame((state, delta) => {
    try {
      if (!meshRef.current) return;
      
      if (isHighlighted) {
        const pulseIntensity = isSelected ? 0.25 : (connectionStrength * 0.2);
        // Use time calculation based on delta directly
        const time = state.clock ? state.clock.getElapsedTime() : performance.now() / 1000;
        const pulse = Math.sin(time * 2.5) * pulseIntensity + 1.1;
        meshRef.current.scale.set(scale * pulse, scale * pulse, scale * pulse);
        
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          const emissiveIntensity = isSelected 
            ? 1.0 + Math.sin(time * 3) * 0.3
            : 0.7 + (connectionStrength * 0.3) + Math.sin(time * 3) * 0.2;
          
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

  // Enhanced opacity settings to match reference image clarity
  const nodeOpacity = useMemo(() => {
    if (isHighlighted) {
      return isSelected ? 0.9 : 0.4; // Increased selected opacity, adjusted highlighted
    }
    return dimmed ? 0.4 : 0.85; // Increased normal opacity for better visibility
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
