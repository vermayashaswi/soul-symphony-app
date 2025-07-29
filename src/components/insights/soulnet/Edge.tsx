
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';

import { useFrame } from '@react-three/fiber';
import { useTheme } from '@/hooks/use-theme';

interface EdgeProps {
  start: [number, number, number];
  end: [number, number, number];
  value: number;
  isHighlighted: boolean;
  dimmed: boolean;
  maxThickness?: number;
  startNodeType?: 'entity' | 'emotion';
  endNodeType?: 'entity' | 'emotion';
  startNodeScale?: number;
  endNodeScale?: number;
}

// Calculate surface connection point for different node types
const calculateSurfacePoint = (
  center: THREE.Vector3, 
  direction: THREE.Vector3, 
  nodeType: 'entity' | 'emotion', 
  scale: number = 1
): THREE.Vector3 => {
  // Base radius for different node types
  const baseRadius = nodeType === 'entity' ? 0.7 : 0.55;
  const actualRadius = baseRadius * scale;
  
  // Normalize direction and scale by radius
  const normalizedDirection = direction.clone().normalize();
  return center.clone().add(normalizedDirection.multiplyScalar(actualRadius));
};

export const Edge: React.FC<EdgeProps> = ({ 
  start, 
  end, 
  value, 
  isHighlighted, 
  dimmed,
  maxThickness = 5,
  startNodeType = 'entity',
  endNodeType = 'emotion',
  startNodeScale = 1,
  endNodeScale = 1
}) => {
  const { theme } = useTheme();
  
  const ref = useRef<THREE.Group>(null);
  // Change the ref type to match what react-three-fiber expects
  const lineRef = useRef<THREE.Mesh>(null);

  const points = useMemo(() => {
    try {
      const startVec = new THREE.Vector3(...start);
      const endVec = new THREE.Vector3(...end);
      
      // Calculate direction vectors for surface connection
      const startToEnd = endVec.clone().sub(startVec);
      const endToStart = startVec.clone().sub(endVec);
      
      // Get surface connection points instead of center points
      const startSurface = calculateSurfacePoint(startVec, startToEnd, startNodeType, startNodeScale);
      const endSurface = calculateSurfacePoint(endVec, endToStart, endNodeType, endNodeScale);
      
      // Create control point for smooth curve
      const midPoint = startSurface.clone().add(endSurface).multiplyScalar(0.5);
      const midOffset = 0.5;
      midPoint.y += midOffset;
      
      const curve = new THREE.QuadraticBezierCurve3(
        startSurface,
        midPoint,
        endSurface
      );
      return curve.getPoints(30);
    } catch (error) {
      console.error("Error creating edge points:", error);
      return [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.1, 0)
      ];
    }
  }, [start, end, startNodeType, endNodeType, startNodeScale, endNodeScale]);

  // Create line geometry once
  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [points]);

  const getEdgeColor = useMemo(() => {
    if (isHighlighted) {
      return theme === 'light' ? '#2563eb' : '#ffffff';
    }
    
    if (dimmed) {
      return theme === 'light' ? '#d1d5db' : '#374151';
    }
    
    return theme === 'light' ? '#9ca3af' : '#6b7280';
  }, [isHighlighted, dimmed, theme]);

  const getEdgeOpacity = useMemo(() => {
    if (isHighlighted) {
      return 1.0;
    }
    
    if (dimmed) {
      return 0.2;
    }
    
    return 0.6;
  }, [isHighlighted, dimmed]);

  useFrame(() => {
    try {
      if (!lineRef.current || !lineRef.current.material) return;
      
      if (lineRef.current.material instanceof THREE.LineBasicMaterial) {
        lineRef.current.material.opacity = getEdgeOpacity;
        lineRef.current.material.color.set(getEdgeColor);
      }
    } catch (error) {
      console.error("Error in Edge useFrame:", error);
    }
  });

  const thickness = useMemo(() => {
    const baseThickness = 0.05;
    const valueMultiplier = Math.max(0.6, Math.min(2.0, value / 10));
    
    if (isHighlighted) {
      return baseThickness * valueMultiplier * 2.5;
    }
    
    if (dimmed) {
      return baseThickness * valueMultiplier * 0.5;
    }
    
    return baseThickness * valueMultiplier;
  }, [value, isHighlighted, dimmed]);
  
  // Create material with appropriate properties
  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: getEdgeColor,
      transparent: true,
      opacity: getEdgeOpacity,
      linewidth: thickness,
      depthWrite: false, // Prevent z-fighting
      depthTest: true,   // Maintain proper depth testing
    });
  }, [getEdgeColor, getEdgeOpacity, thickness]);

  return (
    <group ref={ref}>
      <primitive 
        object={new THREE.Line(lineGeometry, material)} 
        ref={lineRef}
        renderOrder={10} // Render edges before nodes
      />
    </group>
  );
};

export default Edge;
