
import React, { useState, useRef } from 'react';
import { Text } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { universalFontService } from '@/services/universalFontService';
import { useTranslation } from '@/contexts/TranslationContext';

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
  const { currentLanguage } = useTranslation();
  const [displayText] = useState(() => {
    if (!text || typeof text !== 'string') return 'Node';
    const cleanText = text.trim();
    return cleanText || 'Node';
  });

  // Get font URL based on text content and current language
  const fontUrl = universalFontService.getFontUrl(displayText, currentLanguage);
  
  // Load font using React Three Fiber's useLoader with error handling
  let font;
  try {
    font = useLoader(FontLoader, fontUrl);
  } catch (error) {
    console.warn(`[SimpleText] Failed to load font for ${currentLanguage}, falling back to Latin`, error);
    // Fallback to Latin font
    font = useLoader(FontLoader, universalFontService.getFontUrl('fallback', 'en'));
  }

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
  
  // Enhanced outline logic for better readability across languages
  const shouldUseOutline = color !== '#000000' || universalFontService.isComplexScript(displayText);
  const effectiveOutlineWidth = shouldUseOutline ? outlineWidth : 0;
  const effectiveOutlineColor = shouldUseOutline ? (color === '#ffffff' ? '#000000' : outlineColor) : undefined;
  
  console.log(`[SimpleText] Rendering: "${displayText}" (${currentLanguage}) with fontSize: ${size}, color: ${color}, outline: ${shouldUseOutline}`);

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
      renderOrder={renderOrder}
      outlineWidth={effectiveOutlineWidth}
      outlineColor={effectiveOutlineColor}
      whiteSpace={enableWrapping || isMultiLine ? "normal" : "nowrap"}
      lineHeight={1.2}
    >
      {displayText}
    </Text>
  );
};

export default SimpleText;
