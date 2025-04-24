
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface EdgeProps {
  start: [number, number, number];
  end: [number, number, number];
  value: number;
  isHighlighted: boolean;
  dimmed: boolean;
  maxThickness?: number;
}

export const Edge: React.FC<EdgeProps> = ({ 
  start, 
  end, 
  value, 
  isHighlighted, 
  dimmed,
  maxThickness = 5
}) => {
  const ref = useRef<THREE.Group>(null);
  // Change the ref type to match what react-three-fiber expects
  const lineRef = useRef<THREE.Mesh>(null);

  const points = useMemo(() => {
    try {
      const startVec = new THREE.Vector3(...start);
      const endVec = new THREE.Vector3(...end);
      const midPoint = startVec.clone().add(endVec).multiplyScalar(0.5);
      const midOffset = 0.5;
      midPoint.y += midOffset;
      const curve = new THREE.QuadraticBezierCurve3(
        startVec,
        midPoint,
        endVec
      );
      return curve.getPoints(30);
    } catch (error) {
      console.error("Error creating edge points:", error);
      return [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.1, 0)
      ];
    }
  }, [start, end]);

  // Create line geometry once
  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [points]);

  useFrame(() => {
    try {
      if (!lineRef.current || !lineRef.current.material) return;
      
      if (lineRef.current.material instanceof THREE.LineBasicMaterial) {
        if (isHighlighted) {
          lineRef.current.material.opacity = 1.0; // Full opacity for highlighted lines
          lineRef.current.material.color.set('#ffffff');
        } else {
          // Significantly increase base opacity for better visibility on iOS
          lineRef.current.material.opacity = dimmed ? 0.15 : 0.35; 
          lineRef.current.material.color.set(dimmed ? '#444' : "#888");
        }
      }
    } catch (error) {
      console.error("Error in Edge useFrame:", error);
    }
  });

  // Increase non-highlighted lines thickness for better visibility on iOS
  const baseThickness = isHighlighted ? 2.0 : 1.8; // Increase base thickness for better iOS visibility
  const thickness = baseThickness + (value * (isHighlighted ? maxThickness : maxThickness / 1.8));
  
  // Create material with appropriate properties
  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: isHighlighted ? "#ffffff" : (dimmed ? '#444' : "#888"),
      transparent: true,
      opacity: isHighlighted ? 1.0 : (dimmed ? 0.15 : 0.35), // Increased base opacity for iOS
      linewidth: thickness,
    });
  }, [isHighlighted, dimmed, thickness]);

  return (
    <group ref={ref}>
      <primitive 
        object={new THREE.Line(lineGeometry, material)} 
        ref={lineRef}
      />
    </group>
  );
};

export default Edge;
