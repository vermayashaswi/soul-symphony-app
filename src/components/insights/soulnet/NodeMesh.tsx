
import React, { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
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
  const color = useMemo(() => new THREE.Color(displayColor), [displayColor]);
  
  // Simplified initialization - no delayed state
  const [isMounted, setIsMounted] = useState(true);
  
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  
  // SOLUTION 4: Enhanced geometry for better visual states
  const Geometry = useMemo(() => 
    type === 'entity'
      ? <sphereGeometry args={[1.2, 20, 20]} /> // Higher quality spheres
      : <boxGeometry args={[2.0, 2.0, 2.0]} />, // Standard size cubes
    [type]
  );

  // SOLUTION 5: Enhanced visual state system with proper scaling
  useFrame((state) => {
    if (!meshRef.current || !isMounted) return;
    
    try {
      const time = state.clock.elapsedTime;
      
      if (isSelected) {
        // Selected node: bright gold glow, 1.8x scale, intense pulse
        const pulse = Math.sin(time * 3) * 0.1 + 1.8;
        meshRef.current.scale.setScalar(scale * pulse);
        
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          meshRef.current.material.emissiveIntensity = 1.2 + Math.sin(time * 3) * 0.3;
        }
      } else if (isHighlighted) {
        // Connected nodes: bright colors, 1.4x scale, moderate pulse
        const pulse = Math.sin(time * 2) * 0.05 + 1.4;
        meshRef.current.scale.setScalar(scale * pulse);
        
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          meshRef.current.material.emissiveIntensity = 0.8 + Math.sin(time * 2) * 0.2;
        }
      } else if (dimmed) {
        // Dimmed nodes: 0.7x scale, no pulse, minimal glow
        meshRef.current.scale.setScalar(scale * 0.7);
        
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          meshRef.current.material.emissiveIntensity = 0;
        }
      } else {
        // Default nodes: normal scale, subtle glow
        meshRef.current.scale.setScalar(scale);
        
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          meshRef.current.material.emissiveIntensity = 0.1;
        }
      }
    } catch (error) {
      console.warn("NodeMesh animation error:", error);
    }
  });

  // SOLUTION 6: Fixed opacity system - 50% for dimmed (not 75%)
  const nodeOpacity = useMemo(() => {
    if (isSelected) return 1.0; // Selected: fully opaque
    if (isHighlighted) return 1.0; // Connected: fully opaque
    return dimmed ? 0.5 : 0.8; // Dimmed: 50% opacity (was 25%), Default: 80%
  }, [isHighlighted, isSelected, dimmed]);

  // Render immediately - no delay needed
  if (!isMounted) {
    return null;
  }

  return (
    <mesh
      ref={meshRef}
      scale={[scale, scale, scale]}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown(e);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        onPointerUp(e);
      }}
      onPointerOut={onPointerOut}
      onPointerLeave={onPointerLeave}
      renderOrder={1}
    >
      {Geometry}
      <meshStandardMaterial
        color={displayColor}
        transparent={true}
        opacity={nodeOpacity}
        emissive={isSelected ? '#ffd700' : (isHighlighted ? displayColor : '#000000')} // Gold for selected
        emissiveIntensity={isSelected ? 1.2 : (isHighlighted ? 0.8 : (dimmed ? 0 : 0.1))}
        roughness={0.2}
        metalness={0.6}
        depthWrite={true}
      />
    </mesh>
  );
};

export default NodeMesh;
