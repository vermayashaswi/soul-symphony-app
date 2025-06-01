
import React, { useState, useEffect, useRef } from 'react';
import '@/types/three-reference';
import { Text } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useTranslation } from '@/contexts/TranslationContext';
import { getFontForScript, checkFontLoaded, getFontUrlForScript } from '@/utils/fontLoader';

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
  const [fontLoaded, setFontLoaded] = useState(false);
  const [currentFont, setCurrentFont] = useState('Inter');
  const [fontUrl, setFontUrl] = useState<string | undefined>(undefined);
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

  // Font loading and selection effect
  useEffect(() => {
    const loadFont = async () => {
      const textToCheck = translatedText || text;
      const requiredFont = getFontForScript(textToCheck);
      const requiredFontUrl = getFontUrlForScript(textToCheck);
      
      console.log(`[ThreeDimensionalText] Loading font for "${textToCheck}": ${requiredFont}, URL: ${requiredFontUrl}`);
      
      try {
        const isLoaded = await checkFontLoaded(requiredFont);
        if (isLoaded || requiredFontUrl) {
          setCurrentFont(requiredFont);
          setFontUrl(requiredFontUrl);
          setFontLoaded(true);
          console.log(`[ThreeDimensionalText] Font ${requiredFont} loaded successfully with URL: ${requiredFontUrl}`);
        } else {
          console.warn(`[ThreeDimensionalText] Font ${requiredFont} failed to load, using fallback`);
          setCurrentFont('Inter');
          setFontUrl(getFontUrlForScript('default text')); // Get Inter URL
          setFontLoaded(true);
        }
      } catch (error) {
        console.error(`[ThreeDimensionalText] Error loading font ${requiredFont}:`, error);
        setCurrentFont('Inter');
        setFontUrl(getFontUrlForScript('default text')); // Get Inter URL
        setFontLoaded(true);
      }
    };

    loadFont();
  }, [translatedText, text]);

  if (!visible || !text || !fontLoaded) {
    console.log(`[ThreeDimensionalText] Not rendering: visible=${visible}, text="${text}", fontLoaded=${fontLoaded}`);
    return null;
  }

  // Enhanced size calculation for Devanagari
  const effectiveSize = size * (isDevanagari.current ? 4.0 : 2.5); // Further increased Devanagari size
  
  // Enhanced text configuration for better Devanagari readability
  const getMaxWidth = () => {
    if (isDevanagari.current) {
      return 150; // Further increased max width for Devanagari
    } else if (isNonLatinScript.current) {
      return 60;
    }
    return 25;
  };

  const getLetterSpacing = () => {
    if (isDevanagari.current) {
      return 0.3; // Further increased letter spacing for Devanagari
    } else if (isNonLatinScript.current) {
      return 0.08;
    }
    return 0.02;
  };

  const getLineHeight = () => {
    if (isDevanagari.current) {
      return 2.8; // Further increased line height for Devanagari
    } else if (isNonLatinScript.current) {
      return 1.8;
    }
    return 1.4;
  };

  // Enhanced outline for Devanagari
  const getOutlineWidth = () => {
    if (isDevanagari.current) {
      return outlineWidth * 3; // Triple outline width for Devanagari
    }
    return outlineWidth;
  };

  // Enhanced SDF glyph size for Devanagari
  const getSdfGlyphSize = () => {
    if (isDevanagari.current) {
      return 1024; // Maximum resolution for Devanagari
    }
    return 256;
  };

  // Get font weight for the current font
  const getFontWeight = () => {
    if (isDevanagari.current) {
      return bold ? 600 : 500; // Slightly lighter for Devanagari
    }
    return bold ? 700 : 500;
  };

  console.log(`[ThreeDimensionalText] Rendering: "${translatedText}" at position:`, position, 'size:', effectiveSize, 'font:', currentFont, 'fontUrl:', fontUrl, 'isDevanagari:', isDevanagari.current, 'sdfGlyphSize:', getSdfGlyphSize());
  
  return (
    <Text
      ref={textRef}
      position={position}
      color={color}
      fontSize={effectiveSize}
      fontWeight={getFontWeight()}
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
      // Use the dynamically selected font URL - this is the key fix
      font={fontUrl}
      characters={isDevanagari.current ? "अआइईउऊएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह्ािीुूृॄेैोौंःँ़ॐ०१२३४५६७८९।॥" : undefined}
    >
      {translatedText}
    </Text>
  );
};

export default ThreeDimensionalText;
