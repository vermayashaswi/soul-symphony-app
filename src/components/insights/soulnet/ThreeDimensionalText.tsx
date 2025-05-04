
import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

interface ThreeDimensionalTextProps {
  text: string;
  position: [number, number, number];
  color: string;
  size?: number;
  bold?: boolean;
  visible?: boolean;
  opacity?: number;
  skipTranslation?: boolean;
}

const ThreeDimensionalText: React.FC<ThreeDimensionalTextProps> = ({
  text,
  position,
  color,
  size = 0.3,
  bold = false,
  visible = true,
  opacity = 1,
  skipTranslation = false,
}) => {
  const textRef = useRef<any>(null);
  
  // Handle multiline text
  const lines = useMemo(() => {
    return (text || '').split('\n');
  }, [text]);
  
  // Set text properties based on options
  const fontSize = size;
  const lineHeight = 1.2;
  const fontWeight = bold ? 'bold' : 'normal';
  const fillOpacity = visible ? opacity : 0;
  
  // Determine if text contains non-Latin scripts like Hindi
  const containsNonLatinScript = useMemo(() => {
    if (!text) return false;
    // Check for various non-Latin scripts
    const nonLatinPattern = /[\u0900-\u097F\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\u0400-\u04FF]/;
    return nonLatinPattern.test(text);
  }, [text]);
  
  // Add special handling for Devanagari script (Hindi)
  const isDevanagari = useMemo(() => {
    if (!text) return false;
    const devanagariPattern = /[\u0900-\u097F]/;
    return devanagariPattern.test(text);
  }, [text]);
  
  // Adjust size/position/font for non-Latin scripts
  const adjustedSize = useMemo(() => {
    if (isDevanagari) return size * 0.9;  // Make Hindi text slightly smaller
    if (containsNonLatinScript) return size * 0.95;
    return size;
  }, [size, containsNonLatinScript, isDevanagari]);
  
  // Use different font for non-Latin scripts when available
  const fontFamily = useMemo(() => {
    if (isDevanagari) return 'Noto Sans Devanagari';
    if (containsNonLatinScript) return 'Noto Sans';
    return 'Inter, Arial, sans-serif';
  }, [containsNonLatinScript, isDevanagari]);
  
  // Handle multiline text with proper vertical positioning
  if (lines.length > 1) {
    const totalHeight = (lines.length - 1) * lineHeight * fontSize;
    const startY = position[1] + totalHeight / 2;
    
    return (
      <group position={[position[0], position[1], position[2]]}>
        {lines.map((line, i) => (
          <Text
            key={i}
            position={[0, startY - i * lineHeight * fontSize, 0]}
            color={color}
            fontSize={adjustedSize}
            font={fontFamily}
            anchorX="center"
            anchorY="middle"
            fontWeight={fontWeight}
            outlineWidth={0.01}
            outlineColor="#00000080"
            fillOpacity={fillOpacity}
            userData={{ skipTranslation }}
          >
            {line}
          </Text>
        ))}
      </group>
    );
  }
  
  // Single line text
  return (
    <Text
      ref={textRef}
      position={position}
      color={color}
      fontSize={adjustedSize}
      font={fontFamily}
      anchorX="center"
      anchorY="middle"
      fontWeight={fontWeight}
      outlineWidth={0.01}
      outlineColor="#00000080"
      fillOpacity={fillOpacity}
      userData={{ skipTranslation }}
    >
      {text}
    </Text>
  );
};

export default ThreeDimensionalText;
