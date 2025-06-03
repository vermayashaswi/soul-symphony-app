
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

  if (!visible) {
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
