
import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface MobileNodeInteractionProps {
  node: {
    id: string;
    position: [number, number, number];
    type: 'entity' | 'emotion';
  };
  isSelected: boolean;
  isHighlighted: boolean;
  dimmed: boolean;
  onTouch: (nodeId: string, event: any) => void;
  scale: number;
}

export const MobileNodeInteraction: React.FC<MobileNodeInteractionProps> = ({
  node,
  isSelected,
  isHighlighted,
  dimmed,
  onTouch,
  scale
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [animationTime, setAnimationTime] = React.useState(0);
  const [isReady, setIsReady] = React.useState(false);

  // Delayed initialization
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Enhanced pulsing animation for mobile
  useFrame((state, delta) => {
    if (!meshRef.current || !isReady) return;
    
    try {
      setAnimationTime(prev => prev + delta);
      
      if (isSelected || isHighlighted) {
        const pulseIntensity = isSelected ? 0.3 : 0.2;
        const pulse = Math.sin(animationTime * 3) * pulseIntensity + 1.0;
        const targetScale = scale * pulse;
        
        meshRef.current.scale.lerp(
          new THREE.Vector3(targetScale, targetScale, targetScale), 
          0.1
        );
        
        // Enhanced emissive glow
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          const emissiveIntensity = isSelected 
            ? 1.5 + Math.sin(animationTime * 4) * 0.5
            : 1.0 + Math.sin(animationTime * 3) * 0.3;
          
          meshRef.current.material.emissiveIntensity = Math.max(0, Math.min(2, emissiveIntensity));
        }
      } else {
        const targetScale = dimmed ? scale * 0.7 : scale;
        meshRef.current.scale.lerp(
          new THREE.Vector3(targetScale, targetScale, targetScale), 
          0.1
        );
        
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          meshRef.current.material.emissiveIntensity = dimmed ? 0 : 0.2;
        }
      }
    } catch (error) {
      console.warn('[MobileNodeInteraction] Animation error:', error);
    }
  });

  // Mobile-optimized touch detection zone
  const getTouchZoneGeometry = useCallback(() => {
    const baseSize = node.type === 'entity' ? 1.6 : 2.0;
    const touchZoneSize = baseSize * 1.5; // 50% larger touch zone
    
    return node.type === 'entity' 
      ? <sphereGeometry args={[touchZoneSize, 16, 16]} />
      : <boxGeometry args={[touchZoneSize, touchZoneSize, touchZoneSize]} />;
  }, [node.type]);

  // Handle touch interaction
  const handleInteraction = useCallback((event: any) => {
    console.log(`[MobileNodeInteraction] Touch interaction on node ${node.id}`, {
      nodeType: node.type,
      isSelected,
      isHighlighted,
      position: node.position
    });
    
    event.stopPropagation();
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    onTouch(node.id, event);
  }, [node.id, node.type, node.position, isSelected, isHighlighted, onTouch]);

  if (!isReady) return null;

  return (
    <group position={node.position}>
      {/* Invisible touch zone - larger than visual node */}
      <mesh
        ref={meshRef}
        onPointerDown={handleInteraction}
        onPointerUp={handleInteraction}
        onClick={handleInteraction}
        scale={[scale, scale, scale]}
      >
        {getTouchZoneGeometry()}
        <meshBasicMaterial
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      
      {/* Visual feedback for touch interactions */}
      {(isSelected || isHighlighted) && (
        <mesh scale={[scale * 1.2, scale * 1.2, scale * 1.2]}>
          <ringGeometry args={[1.5, 2.0, 16]} />
          <meshBasicMaterial
            color={isSelected ? '#ffffff' : '#ffff00'}
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
            depthTest={false}
          />
        </mesh>
      )}
    </group>
  );
};

export default MobileNodeInteraction;
