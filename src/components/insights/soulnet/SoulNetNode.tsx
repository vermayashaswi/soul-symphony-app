
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SoulNetNodeProps {
  id: string;
  position: [number, number, number];
  type: 'entity' | 'emotion';
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: (id: string) => void;
  themeHex: string;
  shouldShowLabels: boolean;
}

export const SoulNetNode: React.FC<SoulNetNodeProps> = ({
  id,
  position,
  type,
  isSelected,
  isHighlighted,
  onClick,
  themeHex,
  shouldShowLabels
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [animationTime, setAnimationTime] = useState(0);

  // Color scheme
  const color = useMemo(() => {
    if (isSelected) {
      return type === 'entity' ? new THREE.Color('#16a34a') : new THREE.Color('#d97706');
    }
    if (isHighlighted) {
      return type === 'entity' ? new THREE.Color('#22c55e') : new THREE.Color('#f59e0b');
    }
    return new THREE.Color('#888888');
  }, [isSelected, isHighlighted, type]);

  // Scale based on state
  const baseScale = useMemo(() => {
    if (isSelected) return 1.6;
    if (isHighlighted) return 1.3;
    return 1.0;
  }, [isSelected, isHighlighted]);

  // Animation
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    setAnimationTime(prev => prev + delta);
    
    if (isHighlighted || isSelected) {
      const pulse = Math.sin(animationTime * 2) * 0.1 + 1.0;
      const scale = baseScale * pulse;
      meshRef.current.scale.setScalar(scale);
    } else {
      meshRef.current.scale.setScalar(baseScale);
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    onClick(id);
  };

  return (
    <mesh ref={meshRef} position={position} onClick={handleClick}>
      {type === 'entity' ? (
        <sphereGeometry args={[0.8, 32, 32]} />
      ) : (
        <boxGeometry args={[1.6, 1.6, 1.6]} />
      )}
      <meshStandardMaterial
        color={color}
        metalness={0.3}
        roughness={0.8}
        emissive={color}
        emissiveIntensity={isHighlighted ? 0.3 : 0.1}
      />
    </mesh>
  );
};

export default SoulNetNode;
