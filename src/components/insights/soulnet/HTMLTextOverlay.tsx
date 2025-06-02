
import React, { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface HTMLTextOverlayProps {
  text: string;
  position: [number, number, number];
  color?: string;
  size?: number;
  visible?: boolean;
  bold?: boolean;
  containerRef?: React.RefObject<HTMLDivElement>;
}

export const HTMLTextOverlay: React.FC<HTMLTextOverlayProps> = ({
  text,
  position,
  color = '#ffffff',
  size = 0.4,
  visible = true,
  bold = false,
  containerRef
}) => {
  const { camera, gl } = useThree();
  const [screenPosition, setScreenPosition] = useState<{ x: number; y: number } | null>(null);
  const vectorRef = useRef(new THREE.Vector3());
  const mounted = useRef(true);

  // Convert 3D world position to 2D screen coordinates
  useFrame(() => {
    if (!visible || !mounted.current) return;

    try {
      // Create a vector from the 3D position
      vectorRef.current.set(position[0], position[1], position[2]);
      
      // Project to screen coordinates
      vectorRef.current.project(camera);
      
      // Get canvas dimensions
      const canvas = gl.domElement;
      const rect = canvas.getBoundingClientRect();
      
      // Convert normalized device coordinates to screen pixels
      const x = (vectorRef.current.x * 0.5 + 0.5) * rect.width + rect.left;
      const y = (-(vectorRef.current.y) * 0.5 + 0.5) * rect.height + rect.top;
      
      // Check if the position is in front of the camera
      const isInFront = vectorRef.current.z < 1;
      
      if (isInFront) {
        setScreenPosition({ x, y });
      } else {
        setScreenPosition(null);
      }
    } catch (error) {
      console.warn('[HTMLTextOverlay] Position calculation error:', error);
      setScreenPosition(null);
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  if (!visible || !screenPosition || !text) {
    return null;
  }

  // Calculate font size based on the size prop (convert from Three.js units to pixels)
  const fontSize = Math.max(12, size * 40);

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    left: screenPosition.x,
    top: screenPosition.y,
    transform: 'translate(-50%, -50%)',
    color: color,
    fontSize: `${fontSize}px`,
    fontFamily: 'Noto Sans Devanagari, sans-serif',
    fontWeight: bold ? 'bold' : 'normal',
    textAlign: 'center',
    pointerEvents: 'none',
    zIndex: 1000,
    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    maxWidth: '200px',
    lineHeight: '1.2'
  };

  console.log(`[HTMLTextOverlay] Rendering "${text}" at screen position`, screenPosition);

  return (
    <div style={overlayStyle}>
      {text}
    </div>
  );
};

export default HTMLTextOverlay;
