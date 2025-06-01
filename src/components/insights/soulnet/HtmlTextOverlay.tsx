
import React, { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cn } from '@/lib/utils';

interface TextOverlayItem {
  id: string;
  text: string;
  position: [number, number, number];
  color: string;
  size: number;
  visible: boolean;
  bold: boolean;
  isHighlighted: boolean;
  isSelected: boolean;
  nodeType: 'entity' | 'emotion';
}

interface HtmlTextOverlayProps {
  textItems: TextOverlayItem[];
  className?: string;
}

export const HtmlTextOverlay: React.FC<HtmlTextOverlayProps> = ({
  textItems,
  className = ''
}) => {
  const { camera, gl } = useThree();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [screenPositions, setScreenPositions] = useState<Map<string, {x: number, y: number, visible: boolean}>>(new Map());
  const vector = useRef(new THREE.Vector3());
  const canvasRect = useRef<DOMRect | null>(null);

  // Update canvas rect when needed
  useEffect(() => {
    const updateCanvasRect = () => {
      if (gl.domElement) {
        canvasRect.current = gl.domElement.getBoundingClientRect();
      }
    };

    updateCanvasRect();
    window.addEventListener('resize', updateCanvasRect);
    window.addEventListener('scroll', updateCanvasRect);
    
    return () => {
      window.removeEventListener('resize', updateCanvasRect);
      window.removeEventListener('scroll', updateCanvasRect);
    };
  }, [gl.domElement]);

  // Update text positions every frame
  useFrame(() => {
    if (!overlayRef.current || !canvasRect.current) return;

    const newPositions = new Map<string, {x: number, y: number, visible: boolean}>();

    textItems.forEach((item) => {
      if (!item.visible) {
        newPositions.set(item.id, { x: 0, y: 0, visible: false });
        return;
      }

      // Convert 3D position to screen coordinates
      vector.current.set(item.position[0], item.position[1], item.position[2]);
      vector.current.project(camera);

      // Check if the point is behind the camera
      const isVisible = vector.current.z < 1;

      if (isVisible) {
        // Convert normalized device coordinates to screen coordinates
        const x = (vector.current.x * 0.5 + 0.5) * canvasRect.current.width;
        const y = (-vector.current.y * 0.5 + 0.5) * canvasRect.current.height;

        newPositions.set(item.id, { x, y, visible: true });
      } else {
        newPositions.set(item.id, { x: 0, y: 0, visible: false });
      }
    });

    setScreenPositions(newPositions);
  });

  if (!canvasRect.current) return null;

  return (
    <div
      ref={overlayRef}
      className={cn(
        "absolute inset-0 pointer-events-none z-10",
        className
      )}
      style={{
        width: canvasRect.current.width,
        height: canvasRect.current.height,
      }}
    >
      {textItems.map((item) => {
        const screenPos = screenPositions.get(item.id);
        if (!screenPos?.visible || !item.visible) return null;

        const fontSize = Math.max(12, item.size * 32); // Convert to reasonable pixel size
        const textColor = item.color;
        
        return (
          <div
            key={item.id}
            className={cn(
              "absolute whitespace-nowrap select-none transition-all duration-200",
              "text-center transform -translate-x-1/2 -translate-y-1/2",
              "drop-shadow-lg",
              item.bold && "font-bold",
              item.isSelected && "scale-110",
              item.isHighlighted && "scale-105"
            )}
            style={{
              left: screenPos.x,
              top: screenPos.y,
              fontSize: `${fontSize}px`,
              color: textColor,
              textShadow: '2px 2px 4px rgba(0,0,0,0.7), -1px -1px 2px rgba(255,255,255,0.3)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              lineHeight: 1.2,
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.text}
          </div>
        );
      })}
    </div>
  );
};

export default HtmlTextOverlay;
