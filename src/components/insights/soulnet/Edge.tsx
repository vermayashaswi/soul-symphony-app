
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
    if (isHighlighted && !dimmed) {
      const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.3 + 0.7;
      if (lineRef.current.material instanceof THREE.LineBasicMaterial) {
        // Higher base opacity for highlighted connections
        lineRef.current.material.opacity = 0.7 + value * 0.3 * pulse;
      }
    } else {
      if (lineRef.current.material instanceof THREE.LineBasicMaterial) {
        lineRef.current.material.opacity = dimmed ? 0.06 : (0.18 + value * 0.13);
      }
    }
  });

  // Scale thickness based on value (connection strength)
  // Use a minimum thickness to ensure visibility, then scale up based on value
  const baseThickness = 1;
  const thickness = baseThickness + (value * maxThickness);

  return (
    <group ref={ref}>
      <primitive object={new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: dimmed ? '#BBB' : (isHighlighted ? "#ffffff" : "#aaaaaa"),
          transparent: true,
          opacity: dimmed ? 0.06 : (isHighlighted ? 0.8 : 0.3),
          linewidth: thickness
        })
      )} ref={lineRef} />
    </group>
  );
};
