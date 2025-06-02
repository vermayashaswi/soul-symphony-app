import React, { useState, useEffect, useRef } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

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
  size = 1.0, // Keep the improved size from new code
  visible = true,
  renderOrder = 10,
  bold = false,
  outlineWidth = 0.05, // Keep the improved outline from new code
  outlineColor = '#000000',
  maxWidth = 40 // Keep the improved maxWidth from new code
}) => {
  const [isReady, setIsReady] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const textRef = useRef<THREE.Mesh>(null);
  const [hasError, setHasError] = useState(false);

  // Initialize text with validation (restored from old code)
  useEffect(() => {
    if (!text || typeof text !== 'string') {
      setDisplayText('Node');
      setIsReady(true);
      return;
    }

    const cleanText = text.trim();
    if (cleanText.length === 0) {
      setDisplayText('Node');
      setIsReady(true);
      return;
    }

    // Use improved text length limit from new code
    const limitedText = cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText;
    setDisplayText(limitedText);
    setIsReady(true);
  }, [text]);

  // Simple billboarding (restored from old code)
  useFrame(({ camera }) => {
    if (textRef.current && visible && isReady) {
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

  if (!visible || !isReady || hasError) {
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
      font="Inter, system-ui, sans-serif" // CRITICAL: Restored web font for Hindi support
      fontWeight={bold ? "bold" : "normal"} // Keep from new code
      material-transparent={true}
      material-depthTest={false}
      renderOrder={renderOrder}
      outlineWidth={outlineWidth} // Keep from new code
      outlineColor={outlineColor} // Keep from new code
      onError={(error) => {
        console.error('SimplifiedTextRenderer render error:', error);
        setHasError(true);
      }}
    >
      {displayText}
    </Text>
  );
};

export default SimplifiedTextRenderer;