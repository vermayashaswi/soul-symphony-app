
import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { enhancedFontService } from '@/services/enhancedFontService';

interface CanvasTextRendererProps {
  text: string;
  position: [number, number, number];
  color?: string;
  size?: number;
  visible?: boolean;
  renderOrder?: number;
  bold?: boolean;
  maxWidth?: number;
  enableWrapping?: boolean;
}

export const CanvasTextRenderer: React.FC<CanvasTextRendererProps> = ({
  text,
  position,
  color = '#ffffff',
  size = 0.4,
  visible = true,
  renderOrder = 10,
  bold = false,
  maxWidth = 25,
  enableWrapping = false
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [displayText] = useState(() => {
    if (!text || typeof text !== 'string') return 'Node';
    const cleanText = text.trim();
    return cleanText || 'Node';
  });

  // Create canvas texture for the text
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    // Parse multi-line text
    const lines = displayText.split('\n').filter(line => line.trim().length > 0);
    const lineCount = lines.length;

    // Set canvas size - larger for better quality with text wrapping
    const baseCanvasSize = Math.max(512, size * 200);
    canvas.width = baseCanvasSize;
    // Adjust height based on number of lines
    canvas.height = Math.max(baseCanvasSize, baseCanvasSize * (lineCount / 2));

    // Get appropriate font family
    const fontFamily = enhancedFontService.getFallbackFont(displayText);
    const fontSize = Math.floor(baseCanvasSize * 0.08 * Math.max(1, size / 4));
    
    // Configure context
    context.fillStyle = 'transparent';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.fillStyle = color;
    context.font = `${bold ? 'bold' : 'normal'} ${fontSize}px ${fontFamily}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Enhanced multi-line text rendering
    const lineHeight = fontSize * 1.3; // Better line spacing
    const totalTextHeight = lineCount * lineHeight;
    const startY = (canvas.height / 2) - (totalTextHeight / 2) + (lineHeight / 2);
    
    lines.forEach((line, index) => {
      const y = startY + (index * lineHeight);
      
      // Better outline color based on text color for improved contrast
      const strokeWidth = Math.max(1, size * 0.3);
      
      // Use contrasting outline color based on text color
      if (color === '#000000') {
        context.strokeStyle = '#ffffff'; // White outline for black text
      } else {
        context.strokeStyle = '#000000'; // Black outline for other colors
      }
      
      context.lineWidth = strokeWidth;
      context.strokeText(line, canvas.width / 2, y);
      context.fillText(line, canvas.width / 2, y);
    });

    // Create texture
    const newTexture = new THREE.CanvasTexture(canvas);
    newTexture.needsUpdate = true;
    setTexture(newTexture);

    console.log(`[CanvasTextRenderer] Created multi-line texture for: "${displayText}" (${lineCount} lines) with font: ${fontFamily}, size: ${fontSize}, color: ${color}`);

    return () => {
      newTexture.dispose();
    };
  }, [displayText, color, bold, size]);

  // Billboard effect
  useFrame(({ camera }) => {
    if (meshRef.current && visible) {
      try {
        meshRef.current.quaternion.copy(camera.quaternion);
        if (meshRef.current.material) {
          (meshRef.current.material as any).depthTest = false;
          meshRef.current.renderOrder = renderOrder;
        }
      } catch (error) {
        console.warn('[CanvasTextRenderer] Billboard error:', error);
      }
    }
  });

  if (!visible || !texture) {
    return null;
  }

  // Scale plane size with text size and number of lines
  const lines = displayText.split('\n');
  const lineCount = lines.length;
  const planeWidth = size * 2;
  const planeHeight = size * 2 * Math.max(1, lineCount * 0.7); // Adjust height for multiple lines

  return (
    <mesh ref={meshRef} position={position} renderOrder={renderOrder}>
      <planeGeometry args={[planeWidth, planeHeight]} />
      <meshBasicMaterial
        map={texture}
        transparent={true}
        alphaTest={0.1}
        depthTest={false}
      />
    </mesh>
  );
};

export default CanvasTextRenderer;
