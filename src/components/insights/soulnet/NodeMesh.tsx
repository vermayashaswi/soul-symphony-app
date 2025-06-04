
import React, { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import '@/types/three-reference';
import { useFrame } from '@react-three/fiber';

interface NodeMeshProps {
  type: 'entity' | 'emotion';
  nodeType: 'entity' | 'emotion'; // Added missing nodeType prop
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
  nodeType, // Accept the nodeType prop
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
  const [animationTime, setAnimationTime] = useState(0);
  const [isReady, setIsReady] = useState(false);
  
  // Delayed initialization to prevent clock access issues
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  // ENHANCED: Updated geometry creation for 15% larger nodes
  // Use nodeType instead of type for consistency
  const Geometry = useMemo(() => 
    nodeType === 'entity'
      ? <sphereGeometry args={[1.38, 16, 16]} /> // Increased from 1.2 by 15%
      : <boxGeometry args={[2.3, 2.3, 2.3]} />, // Increased from 2.0 by 15%
    [nodeType]
  );

  // Safe animation with manual time tracking
  useFrame((state, delta) => {
    if (!meshRef.current || !isReady) return;
    
    try {
      // Manual time tracking instead of clock access
      setAnimationTime(prev => prev + delta);
      
      if (isHighlighted) {
        const pulseIntensity = isSelected ? 0.25 : (connectionStrength * 0.2);
        const pulse = Math.sin(animationTime * 2.5) * pulseIntensity + 1.1;
        meshRef.current.scale.set(scale * pulse, scale * pulse, scale * pulse);
        
        // Safe material updates
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          const emissiveIntensity = isSelected 
            ? 1.0 + Math.sin(animationTime * 3) * 0.3
            : 0.7 + (connectionStrength * 0.3) + Math.sin(animationTime * 3) * 0.2;
          
          meshRef.current.material.emissiveIntensity = Math.max(0, Math.min(2, emissiveIntensity));
        }
      } else {
        const targetScale = dimmed ? scale * 0.8 : scale;
        meshRef.current.scale.set(targetScale, targetScale, targetScale);
        
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          meshRef.current.material.emissiveIntensity = dimmed ? 0 : 0.1;
        }
      }
    } catch (error) {
      console.warn("NodeMesh animation error:", error);
    }
  });

  // Safe opacity calculation
  const nodeOpacity = useMemo(() => {
    if (isHighlighted) {
      return isSelected ? 0.9 : 0.4;
    }
    return dimmed ? 0.4 : 0.85;
  }, [isHighlighted, isSelected, dimmed]);

  // Don't render until ready
  if (!isReady) {
    return null;
  }

  console.log(`[NodeMesh] ENHANCED: Rendering ${nodeType} mesh with enhanced scale ${scale.toFixed(2)}`);

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
        depthWrite={false}
      />
    </mesh>
  );
};

export default NodeMesh;
