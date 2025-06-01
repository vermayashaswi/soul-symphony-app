
import React, { useState, useEffect, useRef } from 'react';
import '@/types/three-reference';
import { Text } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useTranslation } from '@/contexts/TranslationContext';

interface ThreeDimensionalTextProps {
  text: string;
  position: [number, number, number]; 
  color?: string;
  size?: number;
  bold?: boolean;
  backgroundColor?: string;
  opacity?: number;
  visible?: boolean;
  skipTranslation?: boolean;
  outlineWidth?: number;
  outlineColor?: string;
  renderOrder?: number;
}

export const ThreeDimensionalText: React.FC<ThreeDimensionalTextProps> = ({
  text,
  position,
  color = 'white',
  size = 1.2,
  bold = true,
  backgroundColor,
  opacity = 1,
  visible = true,
  skipTranslation = false,
  outlineWidth = 0.025,
  outlineColor = '#000000',
  renderOrder = 1,
}) => {
  const { translate, currentLanguage } = useTranslation();
  const [translatedText, setTranslatedText] = useState(text);
  const { camera } = useThree();
  const textRef = useRef<THREE.Mesh>(null);
  const lastCameraPosition = useRef<THREE.Vector3>(new THREE.Vector3());
  
  // Enhanced billboarding with improved stability and performance
  useFrame(() => {
    if (textRef.current && camera && visible) {
      const distanceMoved = camera.position.distanceTo(lastCameraPosition.current);
      
      // Update orientation if camera moved significantly
      if (distanceMoved > 0.05) {
        textRef.current.quaternion.copy(camera.quaternion);
        lastCameraPosition.current.copy(camera.position);
      }
      
      // Apply render order consistently
      if (textRef.current && textRef.current.material) {
        (textRef.current.material as any).depthTest = false;
        (textRef.current.material as any).depthWrite = false;
        textRef.current.renderOrder = renderOrder;
      }
    }
  });

  useEffect(() => {
    const translateText = async () => {
      if (skipTranslation || currentLanguage === 'en' || !text) {
        setTranslatedText(text);
        return;
      }
      
      try {
        const result = await translate(text);
        setTranslatedText(result);
        console.log(`[ThreeDimensionalText] Translated "${text}" to "${result}"`);
      } catch (e) {
        console.error('[ThreeDimensionalText] Translation error:', e);
        setTranslatedText(text);
      }
    };
    
    translateText();
  }, [text, currentLanguage, translate, skipTranslation]);

  if (!visible || !text) {
    return null;
  }

  // Simplified text configuration without complex font handling
  const effectiveSize = size * 2.0;
  
  console.log(`[ThreeDimensionalText] Rendering: "${translatedText}" at position:`, position, 'size:', effectiveSize);
  
  return (
    <Text
      ref={textRef}
      position={position}
      color={color}
      fontSize={effectiveSize}
      fontWeight={bold ? 700 : 500}
      anchorX="center"
      anchorY="middle"
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
      maxWidth={25}
      overflowWrap="normal"
      whiteSpace="normal"
      textAlign="center"
      letterSpacing={0.02}
      renderOrder={renderOrder}
      lineHeight={1.4}
      // Enhanced material properties for maximum visibility
      material-transparent={true}
      material-opacity={opacity}
      material-toneMapped={false}
      material-side={THREE.DoubleSide}
      material-depthTest={false}
      material-depthWrite={false}
    >
      {translatedText}
    </Text>
  );
};

export default ThreeDimensionalText;
