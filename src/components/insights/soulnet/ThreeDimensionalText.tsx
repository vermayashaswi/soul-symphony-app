
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
        
        console.log(`[ThreeDimensionalText] Translated "${text}" to "${result}", isDevanagari: ${isDevanagari.current}`);
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

  // Enhanced size calculation for Devanagari
  const effectiveSize = size * (isDevanagari.current ? 3.5 : 2.5); // Increased Devanagari size significantly
  
  // Enhanced text configuration for better Devanagari readability
  const getMaxWidth = () => {
    if (isDevanagari.current) {
      return 120; // Increased max width for Devanagari
    } else if (isNonLatinScript.current) {
      return 60;
    }
    return 25;
  };

  const getLetterSpacing = () => {
    if (isDevanagari.current) {
      return 0.25; // Increased letter spacing for Devanagari
    } else if (isNonLatinScript.current) {
      return 0.08;
    }
    return 0.02;
  };

  const getLineHeight = () => {
    if (isDevanagari.current) {
      return 2.5; // Increased line height for Devanagari
    } else if (isNonLatinScript.current) {
      return 1.8;
    }
    return 1.4;
  };

  // Enhanced outline for Devanagari
  const getOutlineWidth = () => {
    if (isDevanagari.current) {
      return outlineWidth * 2; // Double outline width for Devanagari
    }
    return outlineWidth;
  };

  // Enhanced SDF glyph size for Devanagari
  const getSdfGlyphSize = () => {
    if (isDevanagari.current) {
      return 512; // Much higher resolution for Devanagari
    }
    return 128;
  };

  console.log(`[ThreeDimensionalText] Rendering: "${translatedText}" at position:`, position, 'size:', effectiveSize, 'isDevanagari:', isDevanagari.current, 'sdfGlyphSize:', getSdfGlyphSize());
  
  return (
    <Text
      ref={textRef}
      position={position}
      color={color}
      fontSize={effectiveSize}
      fontWeight={bold ? 700 : 500}
      anchorX="center"
      anchorY="middle"
      outlineWidth={getOutlineWidth()}
      outlineColor={outlineColor}
      maxWidth={getMaxWidth()}
      overflowWrap="normal"
      whiteSpace="normal"
      textAlign="center"
      letterSpacing={getLetterSpacing()}
      sdfGlyphSize={getSdfGlyphSize()}
      renderOrder={renderOrder}
      lineHeight={getLineHeight()}
      // Enhanced material properties for maximum visibility
      material-transparent={true}
      material-opacity={opacity}
      material-toneMapped={false}
      material-side={THREE.DoubleSide}
      material-depthTest={false}
      material-depthWrite={false}
      // Force font loading for complex scripts
      font={isDevanagari.current ? undefined : undefined} // Let drei handle font selection
      characters={isDevanagari.current ? "अआइईउऊएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह्ािीुूृॄेैोौंःँ़ॐ०१२३४५६७८९।॥" : undefined}
    >
      {translatedText}
    </Text>
  );
};

export default ThreeDimensionalText;
