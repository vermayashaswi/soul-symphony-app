
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
  const [hasError, setHasError] = useState(false);
  
  const [displayText] = useState(() => {
    if (!text || typeof text !== 'string') return 'Node';
    const cleanText = text.trim();
    return cleanText || 'Node';
  });

  // Get font URL based on text content with error handling
  const fontUrl = React.useMemo(() => {
    try {
      return simplifiedFontService.getFontUrl(displayText);
    } catch (error) {
      console.warn('[SimpleText] Error getting font URL, using default:', error);
      return 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json';
    }
  }, [displayText]);
  
  // Load font using React Three Fiber's useLoader with error handling
  let font;
  try {
    font = useLoader(FontLoader, fontUrl);
  } catch (error) {
    console.error('[SimpleText] Font loading error:', error);
    setHasError(true);
  }

  // Billboard effect with error handling
  useFrame(({ camera }) => {
    if (textRef.current && visible && !hasError) {
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

  if (!visible || !font || hasError) {
    return null;
  }

  // Check if text has multiple lines
  const isMultiLine = displayText.includes('\n');
  
  // Remove ALL outlines for black text in light theme
  const shouldUseOutline = color !== '#000000';
  const effectiveOutlineWidth = shouldUseOutline ? outlineWidth : 0;
  const effectiveOutlineColor = shouldUseOutline ? (color === '#ffffff' ? '#000000' : outlineColor) : undefined;
  
  console.log(`[SimpleText] Rendering: "${displayText}" with fontSize: ${size}, color: ${color}, outline: ${shouldUseOutline}`);

  try {
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
        onError={(error) => {
          console.error('[SimpleText] Text render error:', error);
          setHasError(true);
        }}
      >
        {displayText}
      </Text>
    );
  } catch (error) {
    console.error('[SimpleText] Component render error:', error);
    return null;
  }
};

export default SimpleText;
