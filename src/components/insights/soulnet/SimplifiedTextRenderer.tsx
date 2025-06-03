
import React, { useRef } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SimplifiedTextRendererProps {
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

export const SimplifiedTextRenderer: React.FC<SimplifiedTextRendererProps> = ({
  text,
  position,
  color = '#ffffff',
  size = 1.0,
  visible = true,
  renderOrder = 10,
  bold = false,
  outlineWidth = 0.05,
  outlineColor = '#000000',
  maxWidth = 40
}) => {
  const textRef = useRef<THREE.Mesh>(null);

  // Clean and prepare text with enhanced Unicode support
  const displayText = React.useMemo(() => {
    if (!text || typeof text !== 'string') return 'Node';
    const cleanText = text.trim();
    // Enhanced text processing for Hindi/Devanagari and other Unicode scripts
    return cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText || 'Node';
  }, [text]);

  // Detect script and get appropriate font
  const fontFamily = React.useMemo(() => {
    // Enhanced Unicode detection and font selection
    if (/[\u0900-\u097F]/.test(displayText)) {
      // Devanagari script (Hindi, Marathi, Sanskrit)
      return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Devanagari", "Noto Sans Hindi", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    }
    
    // Default Latin font stack with good Unicode support
    return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
  }, [displayText]);

  // Billboard effect - make text always face camera
  useFrame(({ camera }) => {
    if (textRef.current && visible) {
      try {
        textRef.current.quaternion.copy(camera.quaternion);
        if (textRef.current.material) {
          (textRef.current.material as any).depthTest = false;
          textRef.current.renderOrder = renderOrder;
        }
      } catch (error) {
        console.warn('[SimplifiedTextRenderer] Billboard error:', error);
      }
    }
  });

  if (!visible) {
    return null;
  }

  console.log(`[SimplifiedTextRenderer] Rendering with Unicode support: "${displayText}" at size ${size} with color ${color} using font: ${fontFamily}`);

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
      material-toneMapped={false}
    >
      {displayText}
    </Text>
  );
};

export default SimplifiedTextRenderer;
