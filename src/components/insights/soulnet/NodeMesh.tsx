import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface NodeMeshProps {
  type: 'entity' | 'emotion';
  scale: number;
  color: string;
  isSelected: boolean;
  isHighlighted: boolean;
  dimmed: boolean;
  onClick: (event: any) => void;
  onPointerDown: (event: any) => void;
  connectionStrength: number;
}

export const NodeMesh: React.FC<NodeMeshProps> = ({
  type,
  scale,
  color,
  isSelected,
  isHighlighted,
  dimmed,
  onClick,
  onPointerDown,
  connectionStrength
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const nodeColor = useMemo(() => new THREE.Color(color), [color]);

  const geometry = useMemo(() => {
    if (type === 'entity') {
      return new THREE.SphereGeometry(0.7, 16, 16);
    } else {
      return new THREE.BoxGeometry(1.1, 1.1, 1.1);
    }
  }, [type]);

  useFrame(() => {
    if (!meshRef.current) return;

    let targetScale = scale;
    let emissiveIntensity = 0;

    if (isSelected) {
      targetScale = scale * 1.3;
      emissiveIntensity = 0.3;
    } else if (isHighlighted) {
      targetScale = scale * 1.15;
      emissiveIntensity = 0.2;
    } else if (dimmed) {
      targetScale = scale * 0.8;
      emissiveIntensity = 0;
    }

    meshRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.1
    );

    if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
      meshRef.current.material.emissiveIntensity = THREE.MathUtils.lerp(
        meshRef.current.material.emissiveIntensity,
        emissiveIntensity,
        0.1
      );
    }
  });

  const opacity = useMemo(() => {
    if (dimmed) return 0.3;
    return 1.0;
  }, [dimmed]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      scale={[scale, scale, scale]}
      onClick={onClick}
      onPointerDown={onPointerDown}
    >
      <meshStandardMaterial
        color={nodeColor}
        transparent={true}
        opacity={opacity}
        emissive={nodeColor}
        emissiveIntensity={0}
      />
    </mesh>
  );
};

export default NodeMesh;