
import React, { useState, useEffect, useRef } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { simpleFontService } from '@/utils/simpleFontService';

interface ReliableTextProps {
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

export const ReliableText: React.FC<ReliableTextProps> = ({
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
  const [fontFamily, setFontFamily] = useState('Inter, system-ui, sans-serif');
  const textRef = useRef<THREE.Mesh>(null);

  // Initialize with clean text and dynamic font selection
  useEffect(() => {
    if (!text || typeof text !== 'string') {
      setDisplayText('Node');
      setFontFamily(simpleFontService.getFontFamily('latin'));
    } else {
      const cleanText = text.trim();
      const limitedText = cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText;
      const finalText = limitedText || 'Node';
      
      setDisplayText(finalText);
      
      // Get appropriate font family for the text
      const dynamicFontFamily = simpleFontService.getFontFamilyForText(finalText);
      setFontFamily(dynamicFontFamily);
      
      console.log(`[ReliableText] Text: "${finalText}", Script: ${simpleFontService.detectScriptType(finalText)}, Font: ${dynamicFontFamily}`);
    }
    setIsReady(true);
  }, [text]);

  // Billboard effect
  useFrame(({ camera }) => {
    if (textRef.current && visible && isReady) {
      try {
        textRef.current.quaternion.copy(camera.quaternion);
        if (textRef.current.material) {
          (textRef.current.material as any).depthTest = false;
          textRef.current.renderOrder = renderOrder;
        }
      } catch (error) {
        console.warn('[ReliableText] Billboard error:', error);
      }
    }
  });

  if (!visible || !isReady || !displayText) {
    return null;
  }

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
      font={fontFamily}
      fontWeight={bold ? "bold" : "normal"}
      material-transparent={true}
      material-depthTest={false}
      renderOrder={renderOrder}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
    >
      {displayText}
    </Text>
  );
};

export default ReliableText;
