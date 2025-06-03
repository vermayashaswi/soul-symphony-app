import React, { useState, useRef } from 'react';
import { Text } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { simplifiedFontService } from '@/services/simplifiedFontService';

interface SimpleTextProps {
  text: string;
  position: [number, number, number];
  color?: string;
  size?: number;
  visible?: boolean;
  renderOrder?: number;
  bold?: boolean;
  outlineWidth?: number;
  outlineColor?: string;
  maxWidth?: number;
  enableWrapping?: boolean;
}

export const SimpleText: React.FC<SimpleTextProps> = ({
  text,
  position,
  color = '#000000', // Default to black
  size = 0.4,
  visible = true,
  renderOrder = 10,
  bold = false,
  outlineWidth = 0.02,
  outlineColor = '#f5f5f5', // Light outline for contrast
  maxWidth = 25,
  enableWrapping = false
}) => {
  const textRef = useRef<THREE.Mesh>(null);
  const [displayText] = useState(() => {
    if (!text || typeof text !== 'string') return 'Node';
    const cleanText = text.trim();
    
    // If wrapping is enabled, don't truncate - let the text component handle wrapping
    if (enableWrapping) {
      return cleanText || 'Node';
    }
    
    // Otherwise, truncate long text as before
    return cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText || 'Node';
  });

  // Get font URL based on text content
  const fontUrl = simplifiedFontService.getFontUrl(displayText);
  
  // Load font using React Three Fiber's useLoader
  const font = useLoader(FontLoader, fontUrl);

  // Billboard effect
  useFrame(({ camera }) => {
    if (textRef.current && visible) {
      try {
        textRef.current.quaternion.copy(camera.quaternion);
        if (textRef.current.material) {
          (textRef.current.material as any).depthTest = false;
          textRef.current.renderOrder = renderOrder;
        }
      } catch (error) {
        console.warn('[SimpleText] Billboard error:', error);
      }
    }
  });

  if (!visible || !font) {
    return null;
  }

  console.log(`[SimpleText] Rendering: "${displayText}" with font loaded from: ${fontUrl}, wrapping: ${enableWrapping}, color: ${color}`);

  return (
    <Text
      ref={textRef}
      position={position}
      color={color}
      fontSize={size}
      anchorX="center"
      anchorY="middle"
      maxWidth={enableWrapping ? maxWidth : undefined}
      textAlign="center"
      font={font}
      fontWeight={bold ? "bold" : "normal"}
      material-transparent={true}
      material-depthTest={false}
      renderOrder={renderOrder}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
      whiteSpace={enableWrapping ? "normal" : "nowrap"}
    >
      {displayText}
    </Text>
  );
};

export default SimpleText;
