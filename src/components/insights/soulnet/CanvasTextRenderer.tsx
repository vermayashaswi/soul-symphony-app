
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

    // Calculate responsive dimensions based on zoom
    const responsiveFontSize = getResponsiveFontSize(size * 50, cameraZoom, 16, 72);
    const responsiveMaxWidth = getResponsiveMaxWidth(maxWidth * 20, cameraZoom, 150, 600);

    // Get appropriate font family
    const fontFamily = enhancedFontService.getFallbackFont(displayText);
    
    // Wrap text if enabled
    const wrappedResult = enableWrapping 
      ? wrapText(displayText, responsiveMaxWidth, responsiveFontSize, fontFamily, bold ? 'bold' : 'normal')
      : { lines: [{ text: displayText, width: responsiveMaxWidth }], totalHeight: responsiveFontSize, maxWidth: responsiveMaxWidth };

    // Set canvas size based on wrapped text dimensions
    const padding = 20;
    const canvasWidth = Math.max(300, wrappedResult.maxWidth + padding * 2);
    const canvasHeight = Math.max(100, wrappedResult.totalHeight + padding * 2);
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Configure context
    context.fillStyle = 'transparent';
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    
    context.fillStyle = color;
    context.font = `${bold ? 'bold' : 'normal'} ${responsiveFontSize}px ${fontFamily}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Calculate line height and starting position
    const lineHeight = responsiveFontSize * 1.2;
    const startY = (canvasHeight - wrappedResult.totalHeight) / 2 + lineHeight / 2;
    
    // Render each line
    wrappedResult.lines.forEach((line, index) => {
      const y = startY + (index * lineHeight);
      
      // Enhanced outline for better readability
      const strokeWidth = Math.max(2, responsiveFontSize * 0.05);
      
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

  // Scale plane size with text size and zoom
  const basePlaneSize = size * 2;
  const zoomScale = Math.max(0.8, Math.min(2.0, (cameraZoom - 20) * 0.02 + 1));
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
