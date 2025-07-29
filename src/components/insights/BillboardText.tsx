import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

interface BillboardTextProps {
  children: string;
  position: [number, number, number];
  fontSize?: number;
  color?: string;
  maxWidth?: number;
  textAlign?: 'left' | 'right' | 'center' | 'justify';
  anchorX?: number | 'left' | 'center' | 'right';
  anchorY?: number | 'top' | 'top-baseline' | 'middle' | 'bottom-baseline' | 'bottom';
  [key: string]: any;
}

export const BillboardText: React.FC<BillboardTextProps> = ({
  children,
  position,
  fontSize = 0.5,
  color = '#ffffff',
  maxWidth = 10,
  textAlign = 'center',
  anchorX = 'center',
  anchorY = 'middle',
  ...props
}) => {
  const meshRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  
  // Memoize the position as a Vector3 for performance
  const positionVector = useMemo(() => new THREE.Vector3(...position), [position]);
  
  // Track last update to limit frequency
  const lastUpdateRef = useRef(0);
  const UPDATE_INTERVAL = 1000 / 30; // 30 FPS max for billboard updates
  
  useFrame((state) => {
    if (!meshRef.current) return;
    
    const now = Date.now();
    if (now - lastUpdateRef.current < UPDATE_INTERVAL) return;
    lastUpdateRef.current = now;
    
    // Robust billboard algorithm that prevents upside-down text
    const textPosition = meshRef.current.getWorldPosition(new THREE.Vector3());
    const cameraPosition = camera.position.clone();
    
    // Calculate direction from text to camera
    const direction = cameraPosition.sub(textPosition).normalize();
    
    // Get camera's up vector (world up in most cases)
    const up = camera.up.clone().normalize();
    
    // Calculate right vector using cross product
    const right = new THREE.Vector3().crossVectors(up, direction).normalize();
    
    // Recalculate up vector to ensure orthogonality
    const correctedUp = new THREE.Vector3().crossVectors(direction, right).normalize();
    
    // Create rotation matrix from these vectors
    const matrix = new THREE.Matrix4();
    matrix.makeBasis(right, correctedUp, direction);
    
    // Apply the rotation to the text group
    meshRef.current.setRotationFromMatrix(matrix);
  });

  return (
    <group ref={meshRef} position={positionVector}>
      <Text
        fontSize={fontSize}
        color={color}
        maxWidth={maxWidth}
        textAlign={textAlign}
        anchorX={anchorX}
        anchorY={anchorY}
        {...props}
      >
        {children}
      </Text>
    </group>
  );
};