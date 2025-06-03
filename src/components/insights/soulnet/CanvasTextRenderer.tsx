
import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { enhancedFontService } from '@/services/enhancedFontService';
import { wrapText, getResponsiveFontSize, getResponsiveMaxWidth } from '@/utils/textWrappingUtils';

interface CanvasTextRendererProps {
  text: string;
  position: [number, number, number];
  color?: string;
  size?: number;
  visible?: boolean;
  renderOrder?: number;
  bold?: boolean;
  maxWidth?: number;
  cameraZoom?: number;
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
  cameraZoom = 45,
  enableWrapping = true
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [displayText] = useState(() => {
    if (!text || typeof text !== 'string') return 'Node';
    const cleanText = text.trim();
    return cleanText.length > 100 ? cleanText.substring(0, 100) + '...' : cleanText || 'Node';
  });

  // Create canvas texture for the text with wrapping support
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    // UPDATED: Calculate responsive dimensions with smaller base sizes
    const responsiveFontSize = getResponsiveFontSize(size * 40, cameraZoom, 14, 60); // Reduced multiplier from 50 to 40
    const responsiveMaxWidth = getResponsiveMaxWidth(maxWidth * 15, cameraZoom, 120, 450); // Reduced multipliers

    // Get appropriate font family
    const fontFamily = enhancedFontService.getFallbackFont(displayText);
    
    // Wrap text if enabled
    const wrappedResult = enableWrapping 
      ? wrapText(displayText, responsiveMaxWidth, responsiveFontSize, fontFamily, bold ? 'bold' : 'normal')
      : { lines: [{ text: displayText, width: responsiveMaxWidth }], totalHeight: responsiveFontSize, maxWidth: responsiveMaxWidth };

    // UPDATED: Set canvas size with reduced padding and dimensions
    const padding = 15; // Reduced from 20
    const canvasWidth = Math.max(250, wrappedResult.maxWidth + padding * 2); // Reduced from 300
    const canvasHeight = Math.max(80, wrappedResult.totalHeight + padding * 2); // Reduced from 100
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Configure context
    context.fillStyle = 'transparent';
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    
    context.fillStyle = color;
    context.font = `${bold ? 'bold' : 'normal'} ${responsiveFontSize}px ${fontFamily}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // UPDATED: Calculate line height using improved spacing (1.1 multiplier)
    const lineHeight = responsiveFontSize * 1.1;
    const startY = (canvasHeight - wrappedResult.totalHeight) / 2 + lineHeight / 2;
    
    // Render each line
    wrappedResult.lines.forEach((line, index) => {
      const y = startY + (index * lineHeight);
      
      // UPDATED: Reduced stroke width for cleaner appearance
      const strokeWidth = Math.max(1.5, responsiveFontSize * 0.04); // Reduced from 2 and 0.05
      
      // Use contrasting outline color
      if (color === '#000000') {
        context.strokeStyle = '#ffffff';
      } else {
        context.strokeStyle = '#000000';
      }
      
      context.lineWidth = strokeWidth;
      context.strokeText(line.text, canvasWidth / 2, y);
      context.fillText(line.text, canvasWidth / 2, y);
    });

    // Create texture
    const newTexture = new THREE.CanvasTexture(canvas);
    newTexture.needsUpdate = true;
    setTexture(newTexture);

    console.log(`[CanvasTextRenderer] Created wrapped texture for: "${displayText}" with ${wrappedResult.lines.length} lines, font: ${fontFamily}, size: ${responsiveFontSize}`);

    return () => {
      newTexture.dispose();
    };
  }, [displayText, color, bold, size, maxWidth, cameraZoom, enableWrapping]);

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

  // UPDATED: Scale plane size with reduced base size and improved zoom scaling
  const basePlaneSize = size * 1.6; // Reduced from 2.0
  const zoomScale = Math.max(0.7, Math.min(1.8, (cameraZoom - 20) * 0.015 + 1)); // Adjusted scaling
  const planeSize = basePlaneSize * zoomScale;

  return (
    <mesh ref={meshRef} position={position} renderOrder={renderOrder}>
      <planeGeometry args={[planeSize, planeSize]} />
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
