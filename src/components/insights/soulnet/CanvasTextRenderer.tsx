
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
}

export const CanvasTextRenderer: React.FC<CanvasTextRendererProps> = ({
  text,
  position,
  color = '#ffffff',
  size = 0.4,
  visible = true,
  renderOrder = 10,
  bold = false,
  maxWidth = 25
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [displayText] = useState(() => {
    if (!text || typeof text !== 'string') return 'Node';
    const cleanText = text.trim();
    return cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText || 'Node';
  });

  // Create canvas texture for the text
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    // Set canvas size
    const canvasSize = 512;
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    // Get appropriate font family
    const fontFamily = enhancedFontService.getFallbackFont(displayText);
    const fontSize = Math.floor(canvasSize * 0.1);
    
    // Configure context
    context.fillStyle = 'transparent';
    context.fillRect(0, 0, canvasSize, canvasSize);
    
    context.fillStyle = color;
    context.font = `${bold ? 'bold' : 'normal'} ${fontSize}px ${fontFamily}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Add text stroke for better visibility
    context.strokeStyle = '#000000';
    context.lineWidth = 2;
    context.strokeText(displayText, canvasSize / 2, canvasSize / 2);
    context.fillText(displayText, canvasSize / 2, canvasSize / 2);

    // Create texture
    const newTexture = new THREE.CanvasTexture(canvas);
    newTexture.needsUpdate = true;
    setTexture(newTexture);

    console.log(`[CanvasTextRenderer] Created texture for: "${displayText}" with font: ${fontFamily}`);

    return () => {
      newTexture.dispose();
    };
  }, [displayText, color, bold]);

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

  const planeSize = size * 2;

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
