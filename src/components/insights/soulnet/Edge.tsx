
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
      // Increase number of points for smoother curves
      return curve.getPoints(30);
    } catch (error) {
      console.error("Error creating edge points:", error);
      // Return fallback points if there's an error
      return [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.1, 0)
      ];
    }
  }, [start, end]);

  useFrame(({ clock }) => {
    try {
      if (!lineRef.current || !lineRef.current.material) return;
      
      if (isHighlighted) {
        // More dramatic pulsating effect for highlighted connections
        const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.4 + 0.6;
        
        if (lineRef.current.material instanceof THREE.LineBasicMaterial) {
          // Higher base opacity for highlighted connections - make them visible!
          lineRef.current.material.opacity = 0.9 + value * 0.1 * pulse;
          
          // Much brighter color when highlighted
          lineRef.current.material.color.set(value > 0.5 ? "#ffffff" : "#e0e0e0");
          
          // Apply glow effect by updating linewidth dramatically
          // Note: linewidth only works in WebGLRenderer with special settings, we're using it for reference only
          lineRef.current.material.linewidth = thickness * pulse;
        }
      } else {
        if (lineRef.current.material instanceof THREE.LineBasicMaterial) {
          // Much more distinct difference between dimmed and normal states
          lineRef.current.material.opacity = dimmed ? 0.03 : 0.08;
          
          // Use less vibrant color for non-highlighted connections
          lineRef.current.material.color.set(dimmed ? '#444' : "#888");
        }
      }
    } catch (error) {
      console.error("Error in Edge useFrame:", error);
    }
  });

  // Scale thickness based on value (connection strength)
  // Increase minimum thickness to ensure visibility
  const baseThickness = isHighlighted ? 3 : 1;
  // When highlighted, scale thickness proportionally to connection strength
  const thickness = baseThickness + (value * (isHighlighted ? maxThickness * 2 : maxThickness/3));

  // Use dashed lines for non-highlighted connections, solid for highlighted
  const dashSize = isHighlighted ? 0 : 0.5;
  const gapSize = isHighlighted ? 0 : 0.2;

  return (
    <group ref={ref}>
      <primitive object={new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineDashedMaterial({
          color: isHighlighted ? "#ffffff" : (dimmed ? '#444' : "#888"),
          transparent: true,
          opacity: isHighlighted ? 0.9 : (dimmed ? 0.03 : 0.08),
          linewidth: thickness,
          scale: 1,
          dashSize: dashSize,
          gapSize: gapSize,
        })
      )} ref={lineRef} onUpdate={self => {
        try {
          if (self instanceof THREE.LineSegments) {
            // Cast to any to bypass TypeScript's type checking for computeLineDistances
            // This method exists on BufferGeometry but TypeScript definitions are incomplete
            (self.geometry as any).computeLineDistances();
          }
        } catch (error) {
          console.error("Error in Edge onUpdate:", error);
        }
      }} />
    </group>
  );
};

export default Edge;
