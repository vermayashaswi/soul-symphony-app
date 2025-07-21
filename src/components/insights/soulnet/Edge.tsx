import React, { useMemo } from 'react';
import * as THREE from 'three';

interface EdgeProps {
  start: [number, number, number];
  end: [number, number, number];
  value: number;
  isHighlighted: boolean;
  dimmed: boolean;
  startNodeType: string;
  endNodeType: string;
}

const Edge: React.FC<EdgeProps> = ({
  start,
  end,
  value,
  isHighlighted,
  dimmed,
  startNodeType,
  endNodeType
}) => {
  const { points, color, opacity } = useMemo(() => {
    const points = [
      new THREE.Vector3(...start),
      new THREE.Vector3(...end)
    ];
    
    let color = '#8b5cf6';
    let opacity = 0.6;
    
    if (isHighlighted) {
      color = '#a855f7';
      opacity = 0.9;
    } else if (dimmed) {
      color = '#6b7280';
      opacity = 0.2;
    }
    
    return { points, color, opacity };
  }, [start, end, isHighlighted, dimmed]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line>
  );
};

export default Edge;