
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
  const [hasError, setHasError] = useState(false);
  
  const displayText = React.useMemo(() => {
    if (!text || typeof text !== 'string') return 'Node';
    const cleanText = text.trim();
    return cleanText || 'Node';
  }, [text]);

  // Create canvas texture for the text
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        console.error('[CanvasTextRenderer] Could not get canvas 2D context');
        setHasError(true);
        return;
      }

      // Parse multi-line text
      const lines = displayText.split('\n').filter(line => line.trim().length > 0);
      const lineCount = lines.length;

      // Consistent canvas size calculation
      const baseCanvasSize = 512;
      canvas.width = baseCanvasSize;
      canvas.height = baseCanvasSize;

      // Get appropriate font family with fallback
      let fontFamily;
      try {
        fontFamily = enhancedFontService.getFallbackFont(displayText);
      } catch (error) {
        console.warn('[CanvasTextRenderer] Error getting font family, using fallback:', error);
        fontFamily = 'Arial, sans-serif';
      }
      
      // Consistent font size calculation
      const fontSize = Math.floor(baseCanvasSize * 0.12);
      
      console.log(`[CanvasTextRenderer] Rendering: "${displayText}" with fontSize: ${fontSize}px, lines: ${lineCount}`);
      
      // Configure context with proper background for crisp text
      context.fillStyle = 'rgba(255, 255, 255, 0)'; // Transparent background
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      context.fillStyle = color;
      context.font = `${bold ? 'bold' : 'normal'} ${fontSize}px ${fontFamily}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      
      // Better anti-aliasing for crisp text
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      
      // Consistent line spacing
      const lineHeight = fontSize * 1.2;
      const totalTextHeight = lineCount * lineHeight;
      const startY = (canvas.height / 2) - (totalTextHeight / 2) + (lineHeight / 2);
      
      lines.forEach((line, index) => {
        const y = startY + (index * lineHeight);
        
        // Only add stroke for non-black text (dark theme)
        if (color !== '#000000') {
          context.strokeStyle = '#000000';
          context.lineWidth = Math.max(1, size * 0.8);
          context.strokeText(line, canvas.width / 2, y);
        }
        
        // Always draw the main text on top - this ensures solid color
        context.fillText(line, canvas.width / 2, y);
      });

      // Create texture with proper settings for crisp rendering
      const newTexture = new THREE.CanvasTexture(canvas);
      newTexture.needsUpdate = true;
      newTexture.generateMipmaps = false;
      newTexture.minFilter = THREE.LinearFilter;
      newTexture.magFilter = THREE.LinearFilter;
      newTexture.format = THREE.RGBAFormat;
      setTexture(newTexture);
      setHasError(false);

      console.log(`[CanvasTextRenderer] Successfully created texture for: "${displayText}"`);

      return () => {
        newTexture.dispose();
      };
    } catch (error) {
      console.error('[CanvasTextRenderer] Error creating canvas texture:', error);
      setHasError(true);
    }
  }, [displayText, color, bold, size]);

  // Billboard effect with error handling
  useFrame(({ camera }) => {
    if (meshRef.current && visible && !hasError) {
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

  if (!visible || hasError || !texture) {
    return null;
  }

  // Consistent plane size
  const planeWidth = size * 2;
  const planeHeight = size * 2;

  try {
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
  } catch (error) {
    console.error('[CanvasTextRenderer] Mesh render error:', error);
    return null;
  }
};

export default CanvasTextRenderer;
