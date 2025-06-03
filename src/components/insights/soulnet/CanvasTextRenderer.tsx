
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
  color = '#000000', // FIXED: Default to black instead of white
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

    // FIXED: Consistent canvas size calculation - no inflation based on line count
    const baseCanvasSize = 512; // Fixed base size for consistency
    canvas.width = baseCanvasSize;
    canvas.height = baseCanvasSize; // Keep square canvas for consistent rendering

    // Get appropriate font family
    const fontFamily = enhancedFontService.getFallbackFont(displayText);
    
    // FIXED: Consistent font size calculation - matches Three.js Text component scaling
    const fontSize = Math.floor(baseCanvasSize * 0.12); // Simplified, consistent calculation
    
    console.log(`[CanvasTextRenderer] FIXED FONT SIZE: Using consistent fontSize: ${fontSize}px for size prop: ${size}, lines: ${lineCount}`);
    
    // Configure context
    context.fillStyle = 'transparent';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.fillStyle = color;
    context.font = `${bold ? 'bold' : 'normal'} ${fontSize}px ${fontFamily}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // FIXED: Consistent line spacing regardless of line count
    const lineHeight = fontSize * 1.2; // Standard line height ratio
    const totalTextHeight = lineCount * lineHeight;
    const startY = (canvas.height / 2) - (totalTextHeight / 2) + (lineHeight / 2);
    
    lines.forEach((line, index) => {
      const y = startY + (index * lineHeight);
      
      // FIXED: Minimal stroke for light theme, more for dark theme
      const strokeWidth = color === '#000000' ? 0.5 : Math.max(1, size * 0.8); // Minimal stroke for black text
      
      // FIXED: Use contrasting outline color only when needed
      if (color === '#000000') {
        // Light theme: minimal white outline for readability
        context.strokeStyle = '#ffffff';
        context.lineWidth = strokeWidth;
        context.strokeText(line, canvas.width / 2, y);
      } else {
        // Dark theme: black outline for white text
        context.strokeStyle = '#000000';
        context.lineWidth = strokeWidth;
        context.strokeText(line, canvas.width / 2, y);
      }
      
      // Always draw the main text on top
      context.fillText(line, canvas.width / 2, y);
    });

    // Create texture
    const newTexture = new THREE.CanvasTexture(canvas);
    newTexture.needsUpdate = true;
    setTexture(newTexture);

    console.log(`[CanvasTextRenderer] FIXED TEXT COLOR: Created texture for: "${displayText}" (${lineCount} lines) with color: ${color}, minimal stroke`);

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

  // FIXED: Consistent plane size - no inflation based on line count
  // Scale directly with size prop for consistent visual appearance
  const planeWidth = size * 2;
  const planeHeight = size * 2; // Keep consistent with single-line text

  console.log(`[CanvasTextRenderer] FIXED PLANE SIZE: Using consistent plane dimensions: ${planeWidth} x ${planeHeight} for size prop: ${size}`);

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
