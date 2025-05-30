
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
  
  // Simplified billboarding with better stability
  useFrame(() => {
    if (textRef.current && camera && visible) {
      const distanceMoved = camera.position.distanceTo(lastCameraPosition.current);
      
      // Update orientation if camera moved enough
      if (distanceMoved > 0.1) {
        textRef.current.quaternion.copy(camera.quaternion);
        lastCameraPosition.current.copy(camera.position);
      }
      
      // Apply render order
      if (textRef.current) {
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
        
        console.log(`ThreeDimensionalText translated "${text}" to "${result}"`);
      } catch (e) {
        console.error('Translation error:', e);
        setTranslatedText(text);
      }
    };
    
    translateText();
  }, [text, currentLanguage, translate, skipTranslation]);

  if (!visible || !text) {
    console.log(`ThreeDimensionalText not rendering: visible=${visible}, text="${text}"`);
    return null;
  }

  // Increased effective size for better visibility
  const effectiveSize = size * 3.0;
  
  // Calculate appropriate max width
  const getMaxWidth = () => {
    if (isDevanagari.current) {
      return 60;
    } else if (isNonLatinScript.current) {
      return 45;
    }
    return 20;
  };

  const getLetterSpacing = () => {
    if (isDevanagari.current) {
      return 0.1;
    } else if (isNonLatinScript.current) {
      return 0.05;
    }
    return 0;
  };

  console.log(`Rendering ThreeDimensionalText: "${translatedText}" at position:`, position, 'size:', effectiveSize);
  
  return (
    <group>
      <Text
        ref={textRef}
        position={position}
        color={color}
        fontSize={effectiveSize}
        fontWeight={bold ? 700 : 400}
        anchorX="center"
        anchorY="middle"
        outlineWidth={outlineWidth}
        outlineColor={outlineColor}
        maxWidth={getMaxWidth()}
        overflowWrap="normal"
        whiteSpace="normal"
        textAlign="center"
        letterSpacing={getLetterSpacing()}
        sdfGlyphSize={isDevanagari.current ? 128 : 64}
        renderOrder={renderOrder}
        lineHeight={isDevanagari.current ? 1.8 : (isNonLatinScript.current ? 1.6 : 1.3)}
        // Force material properties for better visibility
        material-transparent={true}
        material-opacity={opacity}
        material-toneMapped={false}
        material-side={THREE.DoubleSide} // Render both sides for better visibility
      >
        {translatedText}
      </Text>
    </group>
  );
};

export default ThreeDimensionalText;
