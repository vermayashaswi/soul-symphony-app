
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
  const lineRef = useRef<THREE.Line>(null);

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

  useFrame(() => {
    try {
      if (!lineRef.current || !lineRef.current.material) return;
      
      if (lineRef.current.material instanceof THREE.LineBasicMaterial) {
        if (isHighlighted) {
          lineRef.current.material.opacity = 0.9;
          lineRef.current.material.color.set('#ffffff');
        } else {
          lineRef.current.material.opacity = dimmed ? 0.03 : 0.08;
          lineRef.current.material.color.set(dimmed ? '#444' : "#888");
        }
      }
    } catch (error) {
      console.error("Error in Edge useFrame:", error);
    }
  });

  // Scale thickness based on value (connection strength)
  const baseThickness = isHighlighted ? 3 : 1;
  const thickness = baseThickness + (value * (isHighlighted ? maxThickness * 2 : maxThickness/3));

  return (
    <group ref={ref}>
      <line ref={lineRef}>
        <bufferGeometry attach="geometry">
          <bufferAttribute
            attach="attributes-position"
            count={points.length}
            array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial 
          attach="material" 
          color={isHighlighted ? "#ffffff" : (dimmed ? '#444' : "#888")}
          transparent={true}
          opacity={isHighlighted ? 0.9 : (dimmed ? 0.03 : 0.08)}
          linewidth={thickness}
        />
      </line>
    </group>
  );
};

export default Edge;
