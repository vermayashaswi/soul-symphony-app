
import React, { useMemo } from 'react';
import * as THREE from 'three';

interface EdgeProps {
  start: [number, number, number];
  end: [number, number, number];
  value: number;
  isHighlighted: boolean;
  dimmed: boolean;
  maxThickness: number;
  startNodeType: 'entity' | 'emotion';
  endNodeType: 'entity' | 'emotion';
  startNodeScale: number;
  endNodeScale: number;
}

export const Edge: React.FC<EdgeProps> = ({
  start,
  end,
  value,
  isHighlighted,
  dimmed,
  maxThickness,
  startNodeType,
  endNodeType,
  startNodeScale,
  endNodeScale
}) => {
  // Calculate line geometry
  const geometry = useMemo(() => {
    if (!Array.isArray(start) || !Array.isArray(end) || 
        start.length !== 3 || end.length !== 3) {
      return null;
    }

    const points = [
      new THREE.Vector3(start[0], start[1], start[2]),
      new THREE.Vector3(end[0], end[1], end[2])
    ];
    
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [start, end]);

  // Calculate line properties
  const lineWidth = useMemo(() => {
    const baseWidth = Math.max(0.1, Math.min(maxThickness, value * maxThickness));
    return isHighlighted ? baseWidth * 1.5 : baseWidth;
  }, [value, maxThickness, isHighlighted]);

  const opacity = useMemo(() => {
    if (dimmed) return 0.2;
    if (isHighlighted) return 0.9;
    return 0.6;
  }, [isHighlighted, dimmed]);

  const color = useMemo(() => {
    if (isHighlighted) return '#3b82f6';
    if (dimmed) return '#6b7280';
    return '#9ca3af';
  }, [isHighlighted, dimmed]);

  if (!geometry) {
    return null;
  }

  return (
    <primitive object={new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      linewidth: lineWidth
    }))} />
  );
};

export default Edge;
