
import React, { useRef, useMemo, useCallback } from 'react';
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
  const timeRef = useRef(0);
  const animationStateRef = useRef({
    lastUpdate: 0,
    isStable: false
  });
  
  // Memoize geometry to prevent recreation
  const geometry = useMemo(() => {
    return type === 'entity'
      ? new THREE.SphereGeometry(1.4, 16, 16)
      : new THREE.BoxGeometry(2.1, 2.1, 2.1);
  }, [type]);

  // Memoize material to prevent recreation
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: displayColor,
      transparent: true,
      opacity: 0.85,
      emissive: displayColor,
      emissiveIntensity: 0.1,
      roughness: 0.3,
      metalness: 0.4,
      depthWrite: false,
    });
  }, [displayColor]);

  // Safe frame update with error handling
  useFrame((state, delta) => {
    if (!meshRef.current || !meshRef.current.material) return;
    
    try {
      // Use safer time tracking
      timeRef.current += Math.min(delta, 0.1); // Cap delta to prevent jumps
      const now = performance.now();
      
      // Throttle updates for performance
      if (now - animationStateRef.current.lastUpdate < 16) return; // ~60fps cap
      animationStateRef.current.lastUpdate = now;
      
      const mesh = meshRef.current;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      
      // Calculate opacity based on state
      const targetOpacity = isHighlighted 
        ? (isSelected ? 0.9 : 0.7)
        : (dimmed ? 0.4 : 0.85);
      
      // Smooth opacity transition
      const currentOpacity = mat.opacity;
      mat.opacity = THREE.MathUtils.lerp(currentOpacity, targetOpacity, 0.1);
      
      // Update colors safely
      mat.color.setStyle(displayColor);
      mat.emissive.setStyle(displayColor);
      
      if (isHighlighted) {
        const pulseIntensity = isSelected ? 0.25 : (connectionStrength * 0.2);
        const pulse = Math.sin(timeRef.current * 2.5) * pulseIntensity + 1.0;
        const targetScale = scale * pulse;
        
        // Smooth scale transition
        const currentScale = mesh.scale.x;
        const newScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.1);
        mesh.scale.setScalar(newScale);
        
        const emissiveIntensity = isSelected 
          ? 1.0 + Math.sin(timeRef.current * 3) * 0.3
          : 0.7 + (connectionStrength * 0.3) + Math.sin(timeRef.current * 3) * 0.2;
        
        mat.emissiveIntensity = Math.max(0, Math.min(2, emissiveIntensity));
      } else {
        const targetScale = dimmed ? scale * 0.8 : scale;
        const currentScale = mesh.scale.x;
        const newScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.1);
        mesh.scale.setScalar(newScale);
        
        mat.emissiveIntensity = dimmed ? 0 : 0.1;
      }
    } catch (error) {
      console.warn("NodeMesh animation error:", error);
      // Continue without animation rather than crashing
    }
  });

  // Safe event handlers
  const handleClick = useCallback((e: any) => {
    try {
      e.stopPropagation();
      onClick(e);
    } catch (error) {
      console.warn("NodeMesh click error:", error);
    }
  }, [onClick]);

  const handlePointerDown = useCallback((e: any) => {
    try {
      e.stopPropagation();
      onPointerDown(e);
    } catch (error) {
      console.warn("NodeMesh pointer down error:", error);
    }
  }, [onPointerDown]);

  const handlePointerUp = useCallback((e: any) => {
    try {
      e.stopPropagation();
      onPointerUp(e);
    } catch (error) {
      console.warn("NodeMesh pointer up error:", error);
    }
  }, [onPointerUp]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      scale={[scale, scale, scale]}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerOut={onPointerOut}
      onPointerLeave={onPointerLeave}
      renderOrder={1}
      frustumCulled={true}
    />
  );
};

export default NodeMesh;
