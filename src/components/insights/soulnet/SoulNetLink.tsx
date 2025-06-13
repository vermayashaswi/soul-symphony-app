
import React, { useMemo } from 'react';
import * as THREE from 'three';

interface SoulNetLinkProps {
  start: [number, number, number];
  end: [number, number, number];
  strength: number;
  isHighlighted: boolean;
  themeHex: string;
}

export const SoulNetLink: React.FC<SoulNetLinkProps> = ({
  start,
  end,
  strength,
  isHighlighted,
  themeHex
}) => {
  const points = useMemo(() => {
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);
    
    // Create a simple curve between the points
    const midPoint = startVec.clone().add(endVec).multiplyScalar(0.5);
    midPoint.y += 0.5; // Add slight curve
    
    const curve = new THREE.QuadraticBezierCurve3(startVec, midPoint, endVec);
    return curve.getPoints(20);
  }, [start, end]);

  const lineGeometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);

  const color = isHighlighted ? '#ffffff' : '#666666';
  const opacity = isHighlighted ? 0.8 : 0.3;

  return (
    <mesh>
      <primitive object={lineGeometry} />
      <lineBasicMaterial
        color={color}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
};

export default SoulNetLink;
