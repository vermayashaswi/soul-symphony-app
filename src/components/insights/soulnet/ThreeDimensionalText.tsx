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

// Helper function to detect non-Latin script
const containsNonLatinScript = (text: string): boolean => {
  if (!text) return false;
  
  const patterns = {
    devanagari: /[\u0900-\u097F]/,
    arabic: /[\u0600-\u06FF]/,
    chinese: /[\u4E00-\u9FFF]/,
    japanese: /[\u3040-\u309F\u30A0-\u30FF]/,
    korean: /[\uAC00-\uD7AF]/,
    cyrillic: /[\u0400-\u04FF]/
  };
  
  return Object.values(patterns).some(pattern => pattern.test(text));
};

const containsDevanagari = (text: string): boolean => {
  if (!text) return false;
  const devanagariPattern = /[\u0900-\u097F]/;
  return devanagariPattern.test(text);
};

export const ThreeDimensionalText: React.FC<ThreeDimensionalTextProps> = ({
  text,
  position,
  color = 'white',
  size = 1.2,
  bold = false,
  backgroundColor,
  opacity = 1,
  visible = true,
  skipTranslation = false,
  outlineWidth = 0.005,
  outlineColor = '#000000',
  renderOrder = 1,
}) => {
  const { translate, currentLanguage } = useTranslation();
  const [translatedText, setTranslatedText] = useState(text);
  const { camera } = useThree();
  const textRef = useRef<THREE.Mesh>(null);
  const lastCameraPosition = useRef<THREE.Vector3>(new THREE.Vector3());
  const isNonLatinScript = useRef<boolean>(false);
  const isDevanagari = useRef<boolean>(false);
  
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
        isNonLatinScript.current = containsNonLatinScript(text);
        isDevanagari.current = containsDevanagari(text);
        return;
      }
      
      try {
        const result = await translate(text);
        setTranslatedText(result);
        
        isNonLatinScript.current = containsNonLatinScript(result);
        isDevanagari.current = containsDevanagari(result);
        
        console.log(`[ThreeDimensionalText] Translated "${text}" to "${result}"`);
      } catch (e) {
        console.error('[ThreeDimensionalText] Translation error:', e);
        setTranslatedText(text);
      }
    };
    
    translateText();
  }, [text, currentLanguage, translate, skipTranslation]);

  if (!visible || !text) {
    console.log(`[ThreeDimensionalText] Not rendering: visible=${visible}, text="${text}"`);
    return null;
  }

  // Restored original effective size calculation
  const effectiveSize = size * 2.0;
  
  // Enhanced text configuration for better readability
  const getMaxWidth = () => {
    if (isDevanagari.current) {
      return 80;
    } else if (isNonLatinScript.current) {
      return 60;
    }
    return 25;
  };

  const getLetterSpacing = () => {
    if (isDevanagari.current) {
      return 0.15;
    } else if (isNonLatinScript.current) {
      return 0.08;
    }
    return 0.02;
  };

  const getLineHeight = () => {
    if (isDevanagari.current) {
      return 2.0;
    } else if (isNonLatinScript.current) {
      return 1.8;
    }
    return 1.4;
  };

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
      maxWidth={getMaxWidth()}
      overflowWrap="normal"
      whiteSpace="normal"
      textAlign="center"
      letterSpacing={getLetterSpacing()}
      sdfGlyphSize={isDevanagari.current ? 256 : 128}
      renderOrder={renderOrder}
      lineHeight={getLineHeight()}
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
