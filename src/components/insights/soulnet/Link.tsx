import React, { useMemo } from 'react';
import * as THREE from 'three';

interface LinkProps {
  source: THREE.Vector3;
  target: THREE.Vector3;
  strength: number;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  themeHex: string;
  effectiveTheme: 'light' | 'dark';
}

export const Link: React.FC<LinkProps> = ({
  source,
  target,
  strength,
  isHighlighted = false,
  isDimmed = false,
  themeHex,
  effectiveTheme
}) => {
  const { points, color, opacity, lineWidth } = useMemo(() => {
    const points = [source, target];
    
    let color = themeHex;
    let opacity = 0.6;
    let lineWidth = 1;
    
    if (isHighlighted) {
      opacity = 0.9;
      lineWidth = 2;
      const highlightColor = new THREE.Color(themeHex);
      highlightColor.multiplyScalar(1.2);
      color = `#${highlightColor.getHexString()}`;
    } else if (isDimmed) {
      opacity = 0.2;
      lineWidth = 0.5;
      const dimColor = new THREE.Color(themeHex);
      dimColor.multiplyScalar(0.5);
      color = `#${dimColor.getHexString()}`;
    }
    
    return { points, color, opacity, lineWidth };
  }, [source, target, isHighlighted, isDimmed, themeHex]);

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
      <lineBasicMaterial 
        color={color} 
        transparent 
        opacity={opacity}
        linewidth={lineWidth}
      />
    </line>
  );
};