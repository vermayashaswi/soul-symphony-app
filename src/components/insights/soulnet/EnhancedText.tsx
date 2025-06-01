
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Text } from '@react-three/drei';
import { useFrame, useLoader } from '@react-three/fiber';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import * as THREE from 'three';
import { threejsFontService } from '@/services/threejsFontService';

interface EnhancedTextProps {
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
}

export const EnhancedText: React.FC<EnhancedTextProps> = ({
  text,
  position,
  color = '#ffffff',
  size = 0.4,
  visible = true,
  renderOrder = 10,
  bold = false,
  outlineWidth = 0.02,
  outlineColor = '#000000',
  maxWidth = 25
}) => {
  const [isReady, setIsReady] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [fontUrl, setFontUrl] = useState('');
  const [hasError, setHasError] = useState(false);
  const textRef = useRef<THREE.Mesh>(null);

  // Initialize text and determine font URL
  useEffect(() => {
    if (!text || typeof text !== 'string') {
      setDisplayText('Node');
      setFontUrl(threejsFontService.getFontUrl('Inter'));
    } else {
      const cleanText = text.trim();
      const limitedText = cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText;
      const finalText = limitedText || 'Node';
      
      setDisplayText(finalText);
      
      // Get appropriate font URL for the text
      const dynamicFontUrl = threejsFontService.getFontUrlForText(finalText);
      setFontUrl(dynamicFontUrl);
      
      const scriptType = threejsFontService.detectScriptType(finalText);
      const fontName = threejsFontService.getFontNameForText(finalText);
      
      console.log(`[EnhancedText] Text: "${finalText}", Script: ${scriptType}, Font: ${fontName}, URL: ${dynamicFontUrl}`);
    }
    setIsReady(true);
  }, [text]);

  // Load font using useLoader hook
  const font = useLoader(FontLoader, fontUrl, (loader) => {
    console.log(`[EnhancedText] Loading font from: ${fontUrl}`);
  });

  // Billboard effect
  useFrame(({ camera }) => {
    if (textRef.current && visible && isReady && font) {
      try {
        textRef.current.quaternion.copy(camera.quaternion);
        if (textRef.current.material) {
          (textRef.current.material as any).depthTest = false;
          textRef.current.renderOrder = renderOrder;
        }
      } catch (error) {
        console.warn('[EnhancedText] Billboard error:', error);
      }
    }
  });

  // Handle font loading errors
  const handleError = (error: any) => {
    console.error('[EnhancedText] Render error:', error);
    setHasError(true);
  };

  if (!visible || !isReady || !font || hasError) {
    return null;
  }

  console.log(`[EnhancedText] Rendering text: "${displayText}" with font at position`, position);

  return (
    <Text
      ref={textRef}
      position={position}
      color={color}
      fontSize={size}
      anchorX="center"
      anchorY="middle"
      maxWidth={maxWidth}
      textAlign="center"
      font={font}
      fontWeight={bold ? "bold" : "normal"}
      material-transparent={true}
      material-depthTest={false}
      renderOrder={renderOrder}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
      onError={handleError}
    >
      {displayText}
    </Text>
  );
};

export default EnhancedText;
