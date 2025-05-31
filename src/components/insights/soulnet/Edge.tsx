
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import '@/types/three-reference';  // Fixed import path
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
  try {
    // Base radius for different node types
    const baseRadius = nodeType === 'entity' ? 0.7 : 0.55;
    const actualRadius = baseRadius * scale;
    
    // Normalize direction and scale by radius
    const normalizedDirection = direction.clone().normalize();
    return center.clone().add(normalizedDirection.multiplyScalar(actualRadius));
  } catch (error) {
    console.error("Error calculating surface point:", error);
    return center.clone();
  }
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
  const lineRef = useRef<THREE.Line>(null);

  const { points, geometry } = useMemo(() => {
    try {
      // Validate input arrays
      if (!Array.isArray(start) || start.length !== 3 || !Array.isArray(end) || end.length !== 3) {
        console.error("Invalid start/end positions for edge:", start, end);
        return {
          points: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.1, 0)],
          geometry: new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0), 
            new THREE.Vector3(0, 0.1, 0)
          ])
        };
      }

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
      
      const curvePoints = curve.getPoints(30);
      const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
      
      return { points: curvePoints, geometry };
    } catch (error) {
      console.error("Error creating edge geometry:", error);
      const fallbackPoints = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.1, 0)
      ];
      return {
        points: fallbackPoints,
        geometry: new THREE.BufferGeometry().setFromPoints(fallbackPoints)
      };
    }
  }, [start, end, startNodeType, endNodeType, startNodeScale, endNodeScale]);

  // Improved color scheme based on theme
  const getEdgeColor = useMemo(() => {
    if (isHighlighted) {
      return '#ffffff';
    }
    
    if (dimmed) {
      return theme === 'light' ? '#666666' : '#444444';
    }
    
    // Better visibility for non-highlighted edges in light theme
    return theme === 'light' ? '#555555' : '#888888';
  }, [isHighlighted, dimmed, theme]);

  const getEdgeOpacity = useMemo(() => {
    if (isHighlighted) {
      return 0.9;
    }
    
    if (dimmed) {
      return theme === 'light' ? 0.15 : 0.03;
    }
    
    // Better visibility for non-highlighted edges
    return theme === 'light' ? 0.25 : 0.08;
  }, [isHighlighted, dimmed, theme]);

  // Enhanced frame updates with null checks for Three.js objects
  useFrame(() => {
    try {
      if (!lineRef.current || !lineRef.current.material) return;
      
      if (lineRef.current.material instanceof THREE.LineBasicMaterial) {
        // Additional null checks before setting properties
        if (typeof lineRef.current.material.opacity !== 'undefined') {
          lineRef.current.material.opacity = getEdgeOpacity;
        }
        if (lineRef.current.material.color && typeof lineRef.current.material.color.set === 'function') {
          lineRef.current.material.color.set(getEdgeColor);
        }
      }
    } catch (error) {
      console.error("Error in Edge useFrame:", error);
    }
  });

  // Reduce non-highlighted lines thickness by 3x
  const baseThickness = isHighlighted ? 1 : 1; // Adjust non-highlighted base thickness
  const thickness = baseThickness + (value * (isHighlighted ? maxThickness * 2/3 : maxThickness / 3));
  
  // Create material with appropriate properties
  const material = useMemo(() => {
    try {
      return new THREE.LineBasicMaterial({
        color: getEdgeColor,
        transparent: true,
        opacity: getEdgeOpacity,
        linewidth: thickness,
        depthWrite: false, // Prevent z-fighting
        depthTest: true,   // Maintain proper depth testing
      });
    } catch (error) {
      console.error("Error creating edge material:", error);
      return new THREE.LineBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.5
      });
    }
  }, [getEdgeColor, getEdgeOpacity, thickness]);

  // Safe line creation with error handling
  const line = useMemo(() => {
    try {
      return new THREE.Line(geometry, material);
    } catch (error) {
      console.error("Error creating line object:", error);
      const fallbackGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.1, 0)
      ]);
      const fallbackMaterial = new THREE.LineBasicMaterial({ color: '#ffffff' });
      return new THREE.Line(fallbackGeometry, fallbackMaterial);
    }
  }, [geometry, material]);

  return (
    <group ref={ref}>
      <primitive 
        object={line} 
        ref={lineRef}
        renderOrder={10} // Render edges before nodes
      />
    </group>
  );
};

export default Edge;
