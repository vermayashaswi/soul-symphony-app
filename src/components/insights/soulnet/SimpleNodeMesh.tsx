
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SimpleNodeMeshProps {
  type: 'entity' | 'emotion';
  scale: number;
  displayColor: string;
  isHighlighted: boolean;
  dimmed: boolean;
  isSelected: boolean;
  onClick: (e: any) => void;
  onPointerDown?: (e: any) => void;
  onPointerUp?: (e: any) => void;
  onPointerOut?: (e: any) => void;
  onPointerLeave?: (e: any) => void;
}

export const SimpleNodeMesh: React.FC<SimpleNodeMeshProps> = ({
  type,
  scale,
  displayColor,
  isHighlighted,
  dimmed,
  isSelected,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerOut,
  onPointerLeave
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshPhongMaterial>(null);

  // Simple animation for highlighted/selected nodes
  useFrame((state) => {
    if (meshRef.current && (isHighlighted || isSelected)) {
      const time = state.clock.getElapsedTime();
      const pulse = 1 + Math.sin(time * 3) * 0.1;
      meshRef.current.scale.setScalar(scale * pulse);
    } else if (meshRef.current) {
      meshRef.current.scale.setScalar(scale);
    }

    if (materialRef.current) {
      materialRef.current.opacity = dimmed ? 0.4 : 1.0;
    }
  });

  const geometry = type === 'entity' ? (
    <sphereGeometry args={[1.4, 32, 32]} />
  ) : (
    <boxGeometry args={[2.1, 2.1, 2.1]} />
  );

  return (
    <mesh
      ref={meshRef}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerOut={onPointerOut}
      onPointerLeave={onPointerLeave}
      scale={scale}
    >
      {geometry}
      <meshPhongMaterial
        ref={materialRef}
        color={new THREE.Color(displayColor)}
        transparent
        opacity={dimmed ? 0.4 : 1.0}
        shininess={100}
      />
    </mesh>
  );
};

export default SimpleNodeMesh;
