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
    
    // Make the text face the camera
    meshRef.current.lookAt(camera.position);
    
    // Prevent the text from being upside down by constraining rotation
    // This ensures the text always appears right-side up
    const euler = meshRef.current.rotation;
    meshRef.current.rotation.set(euler.x, euler.y, 0);
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