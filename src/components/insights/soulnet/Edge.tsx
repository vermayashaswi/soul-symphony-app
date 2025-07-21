
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

const calculateSurfacePoint = (
  center: THREE.Vector3, 
  direction: THREE.Vector3, 
  nodeType: 'entity' | 'emotion', 
  scale: number = 1
): THREE.Vector3 => {
  const baseRadius = nodeType === 'entity' ? 0.7 : 0.55;
  const actualRadius = baseRadius * scale;
  
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
  const lineRef = useRef<THREE.Mesh>(null);

  const points = useMemo(() => {
    try {
      const startVec = new THREE.Vector3(...start);
      const endVec = new THREE.Vector3(...end);
      
      const startToEnd = endVec.clone().sub(startVec);
      const endToStart = startVec.clone().sub(endVec);
      
      const startSurface = calculateSurfacePoint(startVec, startToEnd, startNodeType, startNodeScale);
      const endSurface = calculateSurfacePoint(endVec, endToStart, endNodeType, endNodeScale);
      
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

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [points]);

  // ENHANCED: Improved color scheme for better touch feedback
  const getEdgeColor = useMemo(() => {
    if (isHighlighted) {
      return '#ffffff'; // Bright white for highlighted connections
    }
    
    if (dimmed) {
      return theme === 'light' ? '#4a4a4a' : '#3a3a3a'; // Lighter dimmed colors
    }
    
    return theme === 'light' ? '#555555' : '#888888'; // Default visibility
  }, [isHighlighted, dimmed, theme]);

  // ENHANCED: Better opacity for mobile visibility
  const getEdgeOpacity = useMemo(() => {
    if (isHighlighted) {
      return 0.95; // Very visible for highlighted
    }
    
    if (dimmed) {
      return theme === 'light' ? 0.08 : 0.06; // Slightly more visible when dimmed
    }
    
    return theme === 'light' ? 0.25 : 0.15; // Better default visibility
  }, [isHighlighted, dimmed, theme]);

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

  // ENHANCED: Much more dramatic thickness for better touch feedback
  const baseThickness = isHighlighted ? 3.0 : 0.2; // Even more dramatic difference
  const thickness = baseThickness + (value * (isHighlighted ? maxThickness * 2 : maxThickness * 0.1));
  
  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: getEdgeColor,
      transparent: true,
      opacity: getEdgeOpacity,
      linewidth: thickness,
      depthWrite: false,
      depthTest: true,
    });
  }, [getEdgeColor, getEdgeOpacity, thickness]);

  return (
    <group ref={ref}>
      <primitive 
        object={new THREE.Line(lineGeometry, material)} 
        ref={lineRef}
        renderOrder={10}
      />
    </group>
  );
};

export default Edge;
