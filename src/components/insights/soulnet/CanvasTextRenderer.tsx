
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
  color = '#000000',
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

    // Consistent canvas size calculation
    const baseCanvasSize = 512;
    canvas.width = baseCanvasSize;
    canvas.height = baseCanvasSize;

    // Get appropriate font family
    const fontFamily = enhancedFontService.getFallbackFont(displayText);
    
    // Consistent font size calculation
    const fontSize = Math.floor(baseCanvasSize * 0.12);
    
    console.log(`[CanvasTextRenderer] PLAN IMPLEMENTATION: Using fontSize: ${fontSize}px for size prop: ${size}, lines: ${lineCount}`);
    
    // PLAN IMPLEMENTATION: Configure context with proper background for crisp text
    context.fillStyle = 'rgba(255, 255, 255, 0)'; // Transparent background
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.fillStyle = color;
    context.font = `${bold ? 'bold' : 'normal'} ${fontSize}px ${fontFamily}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // PLAN IMPLEMENTATION: Better anti-aliasing for crisp text
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    
    // Consistent line spacing
    const lineHeight = fontSize * 1.2;
    const totalTextHeight = lineCount * lineHeight;
    const startY = (canvas.height / 2) - (totalTextHeight / 2) + (lineHeight / 2);
    
    lines.forEach((line, index) => {
      const y = startY + (index * lineHeight);
      
      // PLAN IMPLEMENTATION: NO stroke for black text, minimal for others
      if (color !== '#000000') {
        // Only add stroke for non-black text (dark theme)
        context.strokeStyle = '#000000';
        context.lineWidth = Math.max(1, size * 0.8);
        context.strokeText(line, canvas.width / 2, y);
      }
      
      // Always draw the main text on top - this ensures solid color
      context.fillText(line, canvas.width / 2, y);
    });

    // PLAN IMPLEMENTATION: Create texture with proper settings for crisp rendering
    const newTexture = new THREE.CanvasTexture(canvas);
    newTexture.needsUpdate = true;
    newTexture.generateMipmaps = false;
    newTexture.minFilter = THREE.LinearFilter;
    newTexture.magFilter = THREE.LinearFilter;
    newTexture.format = THREE.RGBAFormat;
    setTexture(newTexture);

    console.log(`[CanvasTextRenderer] PLAN IMPLEMENTATION: Created crisp texture for: "${displayText}" (${lineCount} lines) with color: ${color}, NO stroke for black text`);

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

  // Consistent plane size
  const planeWidth = size * 2;
  const planeHeight = size * 2;

  console.log(`[CanvasTextRenderer] PLAN IMPLEMENTATION: Using consistent plane dimensions: ${planeWidth} x ${planeHeight} for size prop: ${size}`);

  return (
    <mesh ref={meshRef} position={position} renderOrder={renderOrder}>
      <planeGeometry args={[planeWidth, planeHeight]} />
      <meshBasicMaterial
        map={texture}
        transparent={true}
        alphaTest={0.1}
        depthTest={false}
        opacity={1.0}
        premultipliedAlpha={false}
      />
    </mesh>
  );
};

export default CanvasTextRenderer;
