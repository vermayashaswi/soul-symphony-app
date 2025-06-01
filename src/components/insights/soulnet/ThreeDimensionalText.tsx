
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  const isTranslatingRef = useRef(false);
  
  // Enhanced billboarding with improved stability and performance
  useFrame(() => {
    if (!textRef.current || !camera || !visible) return;
    
    try {
      const distanceMoved = camera.position.distanceTo(lastCameraPosition.current);
      
      // Update orientation if camera moved significantly (throttled for performance)
      if (distanceMoved > 0.1) {
        textRef.current.quaternion.copy(camera.quaternion);
        lastCameraPosition.current.copy(camera.position);
      }
      
      // Apply render order consistently
      if (textRef.current.material) {
        const material = textRef.current.material as any;
        material.depthTest = false;
        material.depthWrite = false;
        textRef.current.renderOrder = renderOrder;
      }
    } catch (error) {
      console.warn('Text billboarding error:', error);
    }
  });

  // Safe translation with error handling and throttling
  useEffect(() => {
    const translateText = async () => {
      if (skipTranslation || currentLanguage === 'en' || !text || isTranslatingRef.current) {
        setTranslatedText(text);
        return;
      }
      
      isTranslatingRef.current = true;
      
      try {
        const result = await translate(text);
        setTranslatedText(result || text);
        console.log(`[ThreeDimensionalText] Translated "${text}" to "${result}" for language ${currentLanguage}`);
      } catch (e) {
        console.error('[ThreeDimensionalText] Translation error:', e);
        setTranslatedText(text);
      } finally {
        isTranslatingRef.current = false;
      }
    };
    
    // Debounce translation requests
    const timeoutId = setTimeout(translateText, 100);
    return () => clearTimeout(timeoutId);
  }, [text, currentLanguage, translate, skipTranslation]);

  // Memoized text properties for performance
  const textProps = useMemo(() => {
    const effectiveSize = Math.max(0.4, Math.min(2.0, size * 1.5));
    
    return {
      fontSize: effectiveSize,
      fontWeight: bold ? 700 : 500,
      color,
      outlineWidth,
      outlineColor,
      maxWidth: 20,
      textAlign: 'center' as const,
      anchorX: 'center' as const,
      anchorY: 'middle' as const,
      renderOrder,
      lineHeight: 1.2,
    };
  }, [size, bold, color, outlineWidth, outlineColor, renderOrder]);

  if (!visible || !translatedText) {
    return null;
  }

  console.log(`[ThreeDimensionalText] Rendering: "${translatedText}" at position:`, position, 'size:', textProps.fontSize);
  
  try {
    return (
      <Text
        ref={textRef}
        position={position}
        {...textProps}
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
  } catch (error) {
    console.error('ThreeDimensionalText render error:', error);
    return null;
  }
};

export default ThreeDimensionalText;
