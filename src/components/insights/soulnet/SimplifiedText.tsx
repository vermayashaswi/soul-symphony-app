
import React, { useState, useEffect, useRef } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface SimplifiedTextProps {
  text: string;
  position: [number, number, number];
  color?: string;
  size?: number;
  visible?: boolean;
  renderOrder?: number;
  maxWidth?: number;
}

export const SimplifiedText: React.FC<SimplifiedTextProps> = ({
  text,
  position,
  color = '#ffffff',
  size = 0.5,
  visible = true,
  renderOrder = 10,
  maxWidth = 30
}) => {
  const [isReady, setIsReady] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const textRef = useRef<THREE.Mesh>(null);
  const [hasError, setHasError] = useState(false);

  // Initialize text with validation
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

    // Limit text length for 3D rendering
    const limitedText = cleanText.length > 30 ? cleanText.substring(0, 30) + '...' : cleanText;
    setDisplayText(limitedText);
    setIsReady(true);
  }, [text]);

  // Simple billboarding
  useFrame(({ camera }) => {
    if (textRef.current && visible && isReady) {
      try {
        textRef.current.quaternion.copy(camera.quaternion);
        if (textRef.current.material) {
          (textRef.current.material as any).depthTest = false;
          textRef.current.renderOrder = renderOrder;
        }
      } catch (error) {
        console.warn('Billboarding error:', error);
      }
    }
  });

  if (!visible || !isReady || hasError) {
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
      font="Inter, system-ui, sans-serif"
      material-transparent={true}
      material-depthTest={false}
      renderOrder={renderOrder}
      onError={(error) => {
        console.error('SimplifiedText render error:', error);
        setHasError(true);
      }}
    >
      {displayText}
    </Text>
  );
};

export default SimplifiedText;
