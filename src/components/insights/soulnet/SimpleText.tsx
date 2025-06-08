
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
  color = '#000000',
  size = 0.4,
  visible = true,
  renderOrder = 10,
  bold = false,
  outlineWidth = 0.02,
  outlineColor = '#f5f5f5',
  maxWidth = 25,
  enableWrapping = false
}) => {
  const textRef = useRef<THREE.Mesh>(null);
  const [displayText] = useState(() => {
    if (!text || typeof text !== 'string') return 'Node';
    const cleanText = text.trim();
    return cleanText || 'Node';
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

  // Check if text has multiple lines
  const isMultiLine = displayText.includes('\n');
  
  // PLAN IMPLEMENTATION: Remove ALL outlines for black text in light theme
  const shouldUseOutline = color !== '#000000'; // No outline for black text
  const effectiveOutlineWidth = shouldUseOutline ? outlineWidth : 0;
  const effectiveOutlineColor = shouldUseOutline ? (color === '#ffffff' ? '#000000' : outlineColor) : undefined;
  
  console.log(`[SimpleText] FIXED FONT SIZE IMPLEMENTATION: Rendering "${displayText}" with FIXED fontSize: ${size}, color: ${color}, NO OUTLINE for black text: ${!shouldUseOutline}, frustumCulled: false, sizeAttenuation: false`);

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
      material-opacity={1.0}
      material-sizeAttenuation={false}
      renderOrder={renderOrder}
      outlineWidth={effectiveOutlineWidth}
      outlineColor={effectiveOutlineColor}
      whiteSpace={enableWrapping || isMultiLine ? "normal" : "nowrap"}
      lineHeight={1.2}
      frustumCulled={false}
    >
      {displayText}
    </Text>
  );
};

export default SimpleText;
