import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CanvasTextRenderer } from '../../utils/CanvasTextRenderer';

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
  const planeRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  
  // Memoize the position as a Vector3 for performance
  const positionVector = useMemo(() => new THREE.Vector3(...position), [position]);
  
  // Canvas text renderer instance
  const textRenderer = useMemo(() => new CanvasTextRenderer(), []);
  
  // Track last update to limit frequency
  const lastUpdateRef = useRef(0);
  const UPDATE_INTERVAL = 1000 / 30; // 30 FPS max for billboard updates
  
  // Generate texture and geometry from text
  const { texture, geometry } = useMemo(() => {
    const pixelFontSize = fontSize * 100; // Scale up for better resolution
    const pixelMaxWidth = maxWidth * 100;
    
    const textOptions = {
      text: children,
      fontSize: pixelFontSize,
      fontFamily: 'Arial, sans-serif',
      color,
      maxWidth: pixelMaxWidth,
      textAlign,
      lineHeight: 1.2,
      padding: 20,
    };
    
    const texture = textRenderer.generateTexture(textOptions);
    const size = textRenderer.calculateGeometrySize(textOptions);
    
    // Create plane geometry with calculated size
    const geometry = new THREE.PlaneGeometry(size.width, size.height);
    
    return { texture, geometry };
  }, [children, fontSize, color, maxWidth, textAlign, textRenderer]);
  
  // Update material when texture changes
  useEffect(() => {
    if (planeRef.current && texture) {
      const material = planeRef.current.material as THREE.MeshBasicMaterial;
      material.map = texture;
      material.transparent = true;
      material.alphaTest = 0.1;
      material.needsUpdate = true;
    }
  }, [texture]);
  
  // Cleanup
  useEffect(() => {
    return () => {
      texture?.dispose();
      geometry?.dispose();
      textRenderer.dispose();
    };
  }, [texture, geometry, textRenderer]);
  
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

  return (
    <group ref={meshRef} position={positionVector}>
      <mesh ref={planeRef} geometry={geometry}>
        <meshBasicMaterial
          map={texture}
          transparent
          alphaTest={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};