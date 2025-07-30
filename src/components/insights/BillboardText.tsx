import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { simplifiedFontService } from '../../services/simplifiedFontService';

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
  const [fontUrl, setFontUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Memoize the position as a Vector3 for performance
  const positionVector = useMemo(() => new THREE.Vector3(...position), [position]);
  
  // Load appropriate font based on text content with timeout
  useEffect(() => {
    setIsLoading(true);
    
    // Set timeout to force rendering even if font fails
    const fontTimeout = setTimeout(() => {
      console.warn('BillboardText: Font loading timeout for text:', children);
      setFontUrl(null); // Use default font
      setIsLoading(false);
    }, 1500); // 1.5 second timeout

    const loadFont = async () => {
      try {
        const url = simplifiedFontService.getFontUrl(children);
        setFontUrl(url);
        clearTimeout(fontTimeout);
        setIsLoading(false);
      } catch (error) {
        console.warn('BillboardText: Error loading font for text:', children, error);
        clearTimeout(fontTimeout);
        setFontUrl(null); // Use default font
        setIsLoading(false);
      }
    };

    loadFont();

    return () => clearTimeout(fontTimeout);
  }, [children]);
  
  // Track last update to limit frequency
  const lastUpdateRef = useRef(0);
  const UPDATE_INTERVAL = 1000 / 30; // 30 FPS max for billboard updates
  
  useFrame((state) => {
    if (!meshRef.current) return;
    
    const now = Date.now();
    if (now - lastUpdateRef.current < UPDATE_INTERVAL) return;
    lastUpdateRef.current = now;
    
    // Robust billboard algorithm that prevents text inversion
    const textPosition = meshRef.current.position;
    const cameraPosition = camera.position;
    
    // Calculate direction from text to camera
    const direction = new THREE.Vector3()
      .subVectors(cameraPosition, textPosition)
      .normalize();
    
    // Get camera's up vector (handles non-standard orientations)
    const cameraUp = camera.up.clone().normalize();
    
    // Calculate right vector (perpendicular to both direction and up)
    const right = new THREE.Vector3()
      .crossVectors(cameraUp, direction)
      .normalize();
    
    // Recalculate up vector to ensure orthogonality
    const up = new THREE.Vector3()
      .crossVectors(direction, right)
      .normalize();
    
    // Create rotation matrix that always faces camera without flipping
    const matrix = new THREE.Matrix4();
    matrix.makeBasis(right, up, direction);
    
    // Apply rotation to the text group
    meshRef.current.rotation.setFromRotationMatrix(matrix);
  });

  // Don't render until font is loaded to prevent flashing
  if (isLoading) {
    return null;
  }

  return (
    <group ref={meshRef} position={positionVector}>
      <Text
        fontSize={fontSize}
        color={color}
        maxWidth={maxWidth}
        textAlign={textAlign}
        anchorX={anchorX}
        anchorY={anchorY}
        font={fontUrl || undefined}
        {...props}
      >
        {children}
      </Text>
    </group>
  );
};