
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
    return cleanText.length > 100 ? cleanText.substring(0, 100) + '...' : cleanText || 'Node';
  });

  // Create canvas texture for the text
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    // Set canvas size - larger for better quality with larger text
    const canvasSize = Math.max(512, size * 300); // Increased multiplier for better quality
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    // Get appropriate font family
    const fontFamily = enhancedFontService.getFallbackFont(displayText);
    const fontSize = Math.floor(canvasSize * 0.08 * Math.max(1, size / 4)); // Scale font size appropriately
    
    // Configure context
    context.fillStyle = 'transparent';
    context.fillRect(0, 0, canvasSize, canvasSize);
    
    context.fillStyle = color;
    context.font = `${bold ? 'bold' : 'normal'} ${fontSize}px ${fontFamily}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // ENHANCED: Handle multi-line text with better spacing and positioning
    const lines = displayText.split('\n');
    const lineHeight = fontSize * 1.3; // Slightly increased line height for better readability
    const totalTextHeight = lines.length * lineHeight;
    const startY = (canvasSize / 2) - ((lines.length - 1) * lineHeight) / 2;
    
    // ENHANCED: Better outline for improved contrast
    const strokeWidth = Math.max(3, size * 1.2); // Increased stroke width
    
    lines.forEach((line, index) => {
      const y = startY + (index * lineHeight);
      
      // Use contrasting outline color based on text color
      if (color === '#000000') {
        context.strokeStyle = '#ffffff'; // White outline for black text
      } else {
        context.strokeStyle = '#000000'; // Black outline for other colors
      }
      
      context.lineWidth = strokeWidth;
      context.strokeText(line, canvasSize / 2, y);
      context.fillText(line, canvasSize / 2, y);
    });

    // Create texture with better quality settings
    const newTexture = new THREE.CanvasTexture(canvas);
    newTexture.needsUpdate = true;
    newTexture.generateMipmaps = false;
    newTexture.minFilter = THREE.LinearFilter;
    newTexture.magFilter = THREE.LinearFilter;
    setTexture(newTexture);

    console.log(`[CanvasTextRenderer] Created texture for: "${displayText}" with font: ${fontFamily}, size: ${fontSize}, color: ${color}, lines: ${lines.length}`);

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

  // ENHANCED: Better plane size calculation for multi-line text
  const lines = displayText.split('\n');
  const planeWidth = size * 2.5; // Slightly wider for better text display
  const planeHeight = size * (1.5 + (lines.length - 1) * 0.8); // Dynamic height based on line count

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
