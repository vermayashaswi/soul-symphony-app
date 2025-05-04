
import React from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

interface NodeConnectionProps {
  source: [number, number, number];
  target: [number, number, number];
  strength: number;
  isHighlighted: boolean;
  themeHex: string;
}

const NodeConnection: React.FC<NodeConnectionProps> = ({ 
  source, 
  target, 
  strength, 
  isHighlighted,
  themeHex 
}) => {
  // Create points for the line
  const points = [
    new THREE.Vector3(...source),
    new THREE.Vector3(...target)
  ];
  
  // Create a curve from the points
  const linePoints = React.useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points);
    return curve.getPoints(50);
  }, [source, target]);
  
  // Convert hex to rgb
  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255,
        }
      : { r: 0.5, g: 0.5, b: 0.5 };
  };
  
  // Convert hex color to RGB for Three.js
  const themeColor = hexToRgb(themeHex);
  
  // Set line properties based on state
  const lineOpacity = isHighlighted ? Math.min(0.9, strength * 2) : Math.min(0.3, strength);
  const lineWidth = isHighlighted ? Math.max(1, strength * 3) : Math.max(0.5, strength * 2);
  
  return (
    <Line
      points={linePoints}
      color={new THREE.Color(themeColor.r, themeColor.g, themeColor.b)}
      lineWidth={lineWidth}
      transparent
      opacity={lineOpacity}
    />
  );
};

export default NodeConnection;
