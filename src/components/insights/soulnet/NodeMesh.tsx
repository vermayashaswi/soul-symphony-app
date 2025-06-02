
import React, { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import '@/types/three-reference';
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
  const [isMounted, setIsMounted] = useState(false);
  
  // Safe component initialization
  useEffect(() => {
    console.log(`[NodeMesh] Initializing ${type} node mesh`);
    setIsMounted(true);
    
    const timer = setTimeout(() => {
      if (isMounted) {
        setIsReady(true);
        console.log(`[NodeMesh] ${type} node mesh ready`);
      }
    }, 50);
    
    return () => {
      console.log(`[NodeMesh] Cleaning up ${type} node mesh`);
      setIsMounted(false);
      clearTimeout(timer);
    };
  }, [type]);
  
  // Memoized geometry creation with error handling
  const geometry = useMemo(() => {
    try {
      if (type === 'entity') {
        return <sphereGeometry args={[1.2, 16, 16]} />;
      } else {
        return <boxGeometry args={[2.0, 2.0, 2.0]} />;
      }
    } catch (error) {
      console.warn('[NodeMesh] Error creating geometry:', error);
      // Fallback to simple sphere
      return <sphereGeometry args={[1.0, 8, 8]} />;
    }
  }, [type]);

  // Safe animation with proper error handling and bounds checking
  useFrame((state, delta) => {
    if (!meshRef.current || !isReady || !isMounted) return;
    
    try {
      // Validate delta to prevent extreme values
      const safeDelta = Math.min(Math.max(delta, 0), 0.1);
      
      // Manual time tracking with bounds
      setAnimationTime(prev => {
        const newTime = prev + safeDelta;
        return newTime > 1000 ? 0 : newTime; // Reset after 1000 to prevent overflow
      });
      
      // Safe mesh scaling
      if (isHighlighted && meshRef.current.scale) {
        const pulseIntensity = isSelected ? 0.25 : Math.min(connectionStrength * 0.2, 0.2);
        const pulse = Math.sin(animationTime * 2.5) * pulseIntensity + 1.1;
        const targetScale = Math.min(Math.max(scale * pulse, 0.1), 5); // Bounds checking
        
        meshRef.current.scale.set(targetScale, targetScale, targetScale);
        
        // Safe material updates with validation
        if (meshRef.current.material && meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          const material = meshRef.current.material;
          const baseIntensity = isSelected ? 1.0 : 0.7;
          const strengthBonus = Math.min(connectionStrength * 0.3, 0.3);
          const pulse = Math.sin(animationTime * 3) * 0.3;
          const emissiveIntensity = Math.min(Math.max(baseIntensity + strengthBonus + pulse, 0), 2);
          
          material.emissiveIntensity = emissiveIntensity;
        }
      } else if (meshRef.current.scale) {
        const targetScale = dimmed ? Math.max(scale * 0.8, 0.1) : Math.max(scale, 0.1);
        meshRef.current.scale.set(targetScale, targetScale, targetScale);
        
        // Reset emissive intensity for non-highlighted nodes
        if (meshRef.current.material && meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          meshRef.current.material.emissiveIntensity = dimmed ? 0 : 0.1;
        }
      }
    } catch (error) {
      console.warn('[NodeMesh] Animation error:', error);
      // Fallback to static scale
      if (meshRef.current && meshRef.current.scale) {
        const safeScale = Math.max(scale, 0.1);
        meshRef.current.scale.set(safeScale, safeScale, safeScale);
      }
    }
  });

  // Safe opacity calculation with validation
  const nodeOpacity = useMemo(() => {
    try {
      if (isHighlighted) {
        return isSelected ? 0.9 : Math.min(Math.max(0.4 + connectionStrength * 0.3, 0.4), 0.9);
      }
      return dimmed ? 0.4 : 0.85;
    } catch (error) {
      console.warn('[NodeMesh] Error calculating opacity:', error);
      return 0.7; // Safe fallback
    }
  }, [isHighlighted, isSelected, dimmed, connectionStrength]);

  // Safe color validation
  const safeDisplayColor = useMemo(() => {
    try {
      // Validate color format
      if (typeof displayColor === 'string' && displayColor.match(/^#[0-9A-Fa-f]{6}$/)) {
        return displayColor;
      }
      console.warn('[NodeMesh] Invalid color format:', displayColor);
      return '#ffffff'; // Safe fallback
    } catch (error) {
      console.warn('[NodeMesh] Error validating color:', error);
      return '#ffffff';
    }
  }, [displayColor]);

  // Don't render until ready and mounted
  if (!isReady || !isMounted) {
    return null;
  }

  // Safe event handlers with error boundaries
  const handleClick = (e: any) => {
    try {
      e.stopPropagation();
      onClick(e);
    } catch (error) {
      console.warn('[NodeMesh] Click handler error:', error);
    }
  };

  const handlePointerDown = (e: any) => {
    try {
      onPointerDown(e);
    } catch (error) {
      console.warn('[NodeMesh] PointerDown handler error:', error);
    }
  };

  const handlePointerUp = (e: any) => {
    try {
      onPointerUp(e);
    } catch (error) {
      console.warn('[NodeMesh] PointerUp handler error:', error);
    }
  };

  try {
    return (
      <mesh
        ref={meshRef}
        scale={[Math.max(scale, 0.1), Math.max(scale, 0.1), Math.max(scale, 0.1)]}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOut={onPointerOut}
        onPointerLeave={onPointerLeave}
        renderOrder={1}
      >
        {geometry}
        <meshStandardMaterial
          color={safeDisplayColor}
          transparent={true}
          opacity={nodeOpacity}
          emissive={safeDisplayColor}
          emissiveIntensity={isHighlighted ? 1.2 : (dimmed ? 0 : 0.1)}
          roughness={0.3}
          metalness={0.4}
          depthWrite={false}
        />
      </mesh>
    );
  } catch (error) {
    console.error('[NodeMesh] Fatal render error:', error);
    return null;
  }
};

export default NodeMesh;
