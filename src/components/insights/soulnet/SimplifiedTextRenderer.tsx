
import React, { useRef } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { useLoader } from '@react-three/fiber';

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
  size = 1.0, // FIXED: Increased from 0.6 to 1.0 for better visibility
  visible = true,
  renderOrder = 10,
  bold = false,
  outlineWidth = 0.05, // FIXED: Increased outline width for better definition
  outlineColor = '#000000',
  maxWidth = 40 // FIXED: Increased max width proportionally
}) => {
  const textRef = useRef<THREE.Mesh>(null);
  
  // Use default font for better reliability
  const font = useLoader(FontLoader, '/fonts/helvetiker_regular.typeface.json');

  // Clean and prepare text
  const displayText = React.useMemo(() => {
    if (!text || typeof text !== 'string') return 'Node';
    const cleanText = text.trim();
    return cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText || 'Node';
  }, [text]);

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

  if (!visible || !font) {
    return null;
  }

  console.log(`[SimplifiedTextRenderer] Rendering: "${displayText}" at size ${size} with color ${color}`);

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
    >
      {displayText}
    </Text>
  );
};

export default SimplifiedTextRenderer;
