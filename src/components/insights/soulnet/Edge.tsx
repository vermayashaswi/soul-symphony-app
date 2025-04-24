
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
  const lineRef = useRef<THREE.LineSegments>(null);

  const points = useMemo(() => {
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
    return curve.getPoints(20);
  }, [start, end]);

  useFrame(({ clock }) => {
    if (!lineRef.current || !lineRef.current.material) return;
    
    if (isHighlighted) {
      // More dramatic pulsating effect for highlighted connections
      const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.4 + 0.6;
      
      if (lineRef.current.material instanceof THREE.LineBasicMaterial) {
        // Higher base opacity for highlighted connections - make them visible!
        lineRef.current.material.opacity = 0.8 + value * 0.2 * pulse;
        
        // Much brighter color when highlighted
        lineRef.current.material.color.set(value > 0.5 ? "#ffffff" : "#e0e0e0");
        
        // Apply glow effect by updating linewidth dramatically
        lineRef.current.material.linewidth = isHighlighted ? Math.max(2, thickness * pulse) : thickness;
      }
    } else {
      if (lineRef.current.material instanceof THREE.LineBasicMaterial) {
        // Much more distinct difference between dimmed and normal states
        lineRef.current.material.opacity = dimmed ? 0.05 : 0.15;
        
        // Use less vibrant color for non-highlighted connections
        lineRef.current.material.color.set(dimmed ? '#555' : "#aaaaaa");
      }
    }
  });

  // Scale thickness based on value (connection strength)
  // Use a minimum thickness to ensure visibility, then scale up based on value
  // Make highlighted edges MUCH thicker
  const baseThickness = isHighlighted ? 2 : 1;
  const thickness = baseThickness + (value * (isHighlighted ? maxThickness * 1.5 : maxThickness/2));

  return (
    <group ref={ref}>
      <primitive object={new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: isHighlighted ? "#ffffff" : (dimmed ? '#555' : "#aaaaaa"),
          transparent: true,
          opacity: isHighlighted ? 0.9 : (dimmed ? 0.05 : 0.15),
          linewidth: thickness
        })
      )} ref={lineRef} />
    </group>
  );
};
