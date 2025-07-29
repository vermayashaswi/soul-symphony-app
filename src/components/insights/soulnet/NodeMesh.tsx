
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
  const [animationTime, setAnimationTime] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const color = useMemo(() => new THREE.Color(displayColor), [displayColor]);
  
  // Delayed initialization to prevent clock access issues
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  // ENHANCED: Updated geometry creation for 15% larger nodes
  const Geometry = useMemo(() => 
    type === 'entity'
      ? <sphereGeometry args={[1.38, 16, 16]} /> // Increased from 1.2 by 15%
      : <boxGeometry args={[2.3, 2.3, 2.3]} />, // Increased from 2.0 by 15%
    [type]
  );

  // FIXED: Animation with manual time tracking and mobile support
  useFrame((state, delta) => {
    if (!meshRef.current || !isReady) return;
    
    try {
      // Manual time tracking instead of clock access
      setAnimationTime(prev => prev + delta);
      
      if (isHighlighted) {
        const pulseIntensity = isSelected ? 0.25 : (connectionStrength * 0.2);
        const pulse = Math.sin(animationTime * 2.5) * pulseIntensity + 1.1;
        const targetScale = scale * pulse;
        
        // Apply pulsing scale with smoother transitions
        meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
        
        // Safe material updates
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          const emissiveIntensity = isSelected 
            ? 1.0 + Math.sin(animationTime * 3) * 0.3
            : 0.7 + (connectionStrength * 0.3) + Math.sin(animationTime * 3) * 0.2;
          
          meshRef.current.material.emissiveIntensity = Math.max(0, Math.min(2, emissiveIntensity));
          meshRef.current.material.color.lerp(color, 0.1);
        }
      } else {
        const targetScale = dimmed ? scale * 0.8 : scale;
        
        // Apply static scale with smoother transitions
        meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
        
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          meshRef.current.material.emissiveIntensity = dimmed ? 0 : 0.1;
          meshRef.current.material.color.lerp(color, 0.1);
        }
      }
    } catch (error) {
      console.warn("NodeMesh animation error:", error);
    }
  });

  // FIXED: Much lower opacity for effective dimming
  const nodeOpacity = useMemo(() => {
    if (isSelected) return 1.0;
    if (isHighlighted) return 0.9; 
    return dimmed ? 0.15 : 0.8; // Increased from 0.05 to 0.15 for better visibility but still effective dimming
  }, [isHighlighted, isSelected, dimmed]);

  // Don't render until ready
  if (!isReady) {
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
