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
  // Defensive theme access
  let theme = 'light';
  try {
    const themeData = useTheme();
    theme = themeData.theme;
  } catch (error) {
    console.warn('Theme provider not available, using default theme');
  }
  
  const meshRef = useRef<THREE.Mesh>(null);

  // SOLUTION 1: Use TubeGeometry for visible thickness
  const tubeGeometry = useMemo(() => {
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
      
      // Calculate thickness based on connection strength and highlighting
      const baseThickness = isHighlighted ? 0.08 : 0.015; // Much thicker base for visibility
      const valueMultiplier = Math.max(0.3, Math.min(2.5, value * 1.5)); // Connection strength multiplier
      const radius = baseThickness * valueMultiplier;
      
      console.log(`[Edge] TUBE GEOMETRY: ${start} -> ${end}, value=${value}, highlighted=${isHighlighted}, dimmed=${dimmed}, radius=${radius}`);
      
      // Create tube geometry from curve
      return new THREE.TubeGeometry(curve, 20, radius, 8, false);
    } catch (error) {
      console.error("Error creating tube geometry:", error);
      // Fallback to simple cylinder
      return new THREE.CylinderGeometry(0.02, 0.02, 1, 8);
    }
  }, [start, end, startNodeType, endNodeType, startNodeScale, endNodeScale, value, isHighlighted, dimmed]);

  // SOLUTION 2: Enhanced color and opacity system
  const edgeColor = useMemo(() => {
    if (isHighlighted) {
      return '#60a5fa'; // Bright blue for highlighted connections
    }
    
    if (dimmed) {
      return theme === 'light' ? '#9ca3af' : '#6b7280'; // Medium gray for dimmed
    }
    
    // Default state - subtle but visible
    return theme === 'light' ? '#d1d5db' : '#4b5563';
  }, [isHighlighted, dimmed, theme]);

  const edgeOpacity = useMemo(() => {
    if (isHighlighted) {
      return 0.9; // Very visible for highlighted
    }
    
    if (dimmed) {
      return 0.3; // 50% opacity for dimmed (not 75% like nodes)
    }
    
    // Default state
    return 0.6; // Moderate visibility for default
  }, [isHighlighted, dimmed, theme]);

  // SOLUTION 3: Enhanced material with emissive properties
  const tubeMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: edgeColor,
      transparent: true,
      opacity: edgeOpacity,
      emissive: isHighlighted ? edgeColor : '#000000',
      emissiveIntensity: isHighlighted ? 0.3 : 0,
      roughness: 0.4,
      metalness: 0.2,
      depthWrite: true,
      depthTest: true,
    });
  }, [edgeColor, edgeOpacity, isHighlighted]);

  // Update material properties on each frame for smooth transitions
  useFrame(() => {
    if (!meshRef.current || !meshRef.current.material) return;
    
    try {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.opacity = edgeOpacity;
      material.color.set(edgeColor);
      
      if (isHighlighted) {
        material.emissive.set(edgeColor);
        material.emissiveIntensity = 0.3;
      } else {
        material.emissive.set('#000000');
        material.emissiveIntensity = 0;
      }
    } catch (error) {
      console.error("Error in Edge useFrame:", error);
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={tubeGeometry}
      material={tubeMaterial}
      renderOrder={5} // Render edges before nodes but after background
    />
  );
};

export default Edge;