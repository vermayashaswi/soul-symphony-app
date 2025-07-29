
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
  
  // ENHANCED: Updated geometry creation for 15% larger nodes
  const Geometry = useMemo(() => 
    type === 'entity'
      ? <sphereGeometry args={[1.38, 16, 16]} /> // Increased from 1.2 by 15%
      : <boxGeometry args={[2.3, 2.3, 2.3]} />, // Increased from 2.0 by 15%
    [type]
  );

  // SIMPLIFIED: Safe animation without complex state management
  useFrame((state) => {
    if (!meshRef.current || !isMounted) return;
    
    try {
      const time = state.clock.elapsedTime;
      
      if (isHighlighted) {
        const pulseIntensity = isSelected ? 0.15 : (connectionStrength * 0.1);
        const pulse = Math.sin(time * 2) * pulseIntensity + 1.05;
        const targetScale = scale * pulse;
        
        // Direct scale update without lerping
        meshRef.current.scale.setScalar(targetScale);
        
        // Simplified material updates
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          const emissiveIntensity = isSelected 
            ? 0.8 + Math.sin(time * 2.5) * 0.2
            : 0.5 + (connectionStrength * 0.2);
          
          meshRef.current.material.emissiveIntensity = Math.max(0, Math.min(1.5, emissiveIntensity));
        }
      } else {
        const targetScale = dimmed ? scale * 0.8 : scale;
        meshRef.current.scale.setScalar(targetScale);
        
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          meshRef.current.material.emissiveIntensity = dimmed ? 0 : 0.1;
        }
      }
    } catch (error) {
      console.warn("NodeMesh animation error:", error);
    }
  });

  // FIXED: Better opacity handling for highlighting effect
  const nodeOpacity = useMemo(() => {
    if (isSelected) return 1.0;
    if (isHighlighted) return 0.95; 
    return dimmed ? 0.25 : 0.8; // Increased from 0.15 to 0.25 for better visibility of dimmed nodes
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
        emissive={displayColor}
        emissiveIntensity={isHighlighted ? 1.2 : (dimmed ? 0 : 0.1)}
        roughness={0.3}
        metalness={0.4}
        depthWrite={true}
      />
    </mesh>
  );
};

export default NodeMesh;
