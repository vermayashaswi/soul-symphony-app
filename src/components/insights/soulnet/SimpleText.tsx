
import React, { useState, useRef, useMemo } from 'react';
import { Text } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { simplifiedFontService } from '@/services/simplifiedFontService';
import { wrapText, getResponsiveFontSize, getResponsiveMaxWidth } from '@/utils/textWrappingUtils';

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
  cameraZoom?: number;
  enableWrapping?: boolean;
}

export const SimpleText: React.FC<SimpleTextProps> = ({
  text,
  position,
  color = '#ffffff',
  size = 0.4,
  visible = true,
  renderOrder = 10,
  bold = false,
  outlineWidth = 0.02,
  outlineColor = '#000000',
  maxWidth = 25,
  cameraZoom = 45,
  enableWrapping = true
}) => {
  const textRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  const [displayText] = useState(() => {
    if (!text || typeof text !== 'string') return 'Node';
    const cleanText = text.trim();
    return cleanText.length > 100 ? cleanText.substring(0, 100) + '...' : cleanText || 'Node';
  });

  // Get font URL based on text content
  const fontUrl = simplifiedFontService.getFontUrl(displayText);
  
  // Load font using React Three Fiber's useLoader
  const font = useLoader(FontLoader, fontUrl);

  // Calculate wrapped text lines and responsive sizing
  const wrappedTextData = useMemo(() => {
    if (!enableWrapping) {
      return {
        lines: [{ text: displayText, width: maxWidth * 10 }],
        responsiveFontSize: size,
        responsiveMaxWidth: maxWidth
      };
    }

    const responsiveFontSize = getResponsiveFontSize(size * 50, cameraZoom, 0.3, 3.0);
    const responsiveMaxWidth = getResponsiveMaxWidth(maxWidth, cameraZoom, 15, 50);
    
    const wrappedResult = wrapText(
      displayText, 
      responsiveMaxWidth * 10, // Convert to pixels for measurement
      responsiveFontSize * 50, // Convert to pixels for measurement
      'Arial, sans-serif',
      bold ? 'bold' : 'normal'
    );

    return {
      lines: wrappedResult.lines,
      responsiveFontSize: responsiveFontSize,
      responsiveMaxWidth: responsiveMaxWidth
    };
  }, [displayText, size, maxWidth, cameraZoom, enableWrapping, bold]);

  // Billboard effect for the group
  useFrame(({ camera }) => {
    if (groupRef.current && visible) {
      try {
        groupRef.current.quaternion.copy(camera.quaternion);
      } catch (error) {
        console.warn('[SimpleText] Billboard error:', error);
      }
    }
  });

  if (!visible || !font) {
    return null;
  }

  console.log(`[SimpleText] Rendering wrapped text: "${displayText}" with ${wrappedTextData.lines.length} lines, font size: ${wrappedTextData.responsiveFontSize}`);

  const lineHeight = wrappedTextData.responsiveFontSize * 1.2;
  const totalHeight = wrappedTextData.lines.length * lineHeight;
  const startY = (totalHeight - lineHeight) / 2;

  return (
    <group ref={groupRef} position={position}>
      {wrappedTextData.lines.map((line, index) => {
        const yOffset = startY - (index * lineHeight);
        const linePosition: [number, number, number] = [0, yOffset, 0];

        return (
          <Text
            key={`line-${index}`}
            position={linePosition}
            color={color}
            fontSize={wrappedTextData.responsiveFontSize}
            anchorX="center"
            anchorY="middle"
            maxWidth={wrappedTextData.responsiveMaxWidth}
            textAlign="center"
            font={font}
            fontWeight={bold ? "bold" : "normal"}
            material-transparent={true}
            material-depthTest={false}
            renderOrder={renderOrder + index}
            outlineWidth={outlineWidth}
            outlineColor={outlineColor}
          >
            {line.text}
          </Text>
        );
      })}
    </group>
  );
};

export default SimpleText;
