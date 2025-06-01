
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

// Enhanced script detection with better coverage
const containsNonLatinScript = (text: string): boolean => {
  if (!text) return false;
  
  const patterns = {
    devanagari: /[\u0900-\u097F]/,
    arabic: /[\u0600-\u06FF]/,
    chinese: /[\u4E00-\u9FFF]/,
    japanese: /[\u3040-\u309F\u30A0-\u30FF]/,
    korean: /[\uAC00-\uD7AF]/,
    cyrillic: /[\u0400-\u04FF]/,
    thai: /[\u0E00-\u0E7F]/,
    bengali: /[\u0980-\u09FF]/,
    gujarati: /[\u0A80-\u0AFF]/,
    gurmukhi: /[\u0A00-\u0A7F]/,
    kannada: /[\u0C80-\u0CFF]/,
    malayalam: /[\u0D00-\u0D7F]/,
    oriya: /[\u0B00-\u0B7F]/,
    tamil: /[\u0B80-\u0BFF]/,
    telugu: /[\u0C00-\u0C7F]/
  };
  
  return Object.values(patterns).some(pattern => pattern.test(text));
};

const containsDevanagari = (text: string): boolean => {
  if (!text) return false;
  const devanagariPattern = /[\u0900-\u097F]/;
  return devanagariPattern.test(text);
};

// Text validation utility
const validateText = (text: string): { isValid: boolean; reason?: string } => {
  if (!text || typeof text !== 'string') {
    return { isValid: false, reason: 'Text is empty or not a string' };
  }
  
  if (text.trim().length === 0) {
    return { isValid: false, reason: 'Text is only whitespace' };
  }
  
  if (text.length > 200) {
    return { isValid: false, reason: 'Text is too long for 3D rendering' };
  }
  
  return { isValid: true };
};

// Enhanced fallback text generation
const generateFallbackText = (originalText: string): string => {
  if (!originalText) return 'Text';
  
  // Try to extract English words first
  const englishWords = originalText.match(/[a-zA-Z]+/g);
  if (englishWords && englishWords.length > 0) {
    return englishWords.slice(0, 2).join(' ');
  }
  
  // Extract first few characters if no English words
  const firstChars = originalText.substring(0, 10).trim();
  if (firstChars) return firstChars;
  
  return 'Entity';
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
  const [displayText, setDisplayText] = useState(text);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const { camera } = useThree();
  const textRef = useRef<THREE.Mesh>(null);
  const lastCameraPosition = useRef<THREE.Vector3>(new THREE.Vector3());
  const isNonLatinScript = useRef<boolean>(false);
  const isDevanagari = useRef<boolean>(false);
  const retryCount = useRef<number>(0);
  
  // Enhanced billboarding with improved stability
  useFrame(() => {
    if (textRef.current && camera && visible) {
      const distanceMoved = camera.position.distanceTo(lastCameraPosition.current);
      
      if (distanceMoved > 0.05) {
        textRef.current.quaternion.copy(camera.quaternion);
        lastCameraPosition.current.copy(camera.position);
      }
      
      if (textRef.current && textRef.current.material) {
        (textRef.current.material as any).depthTest = false;
        (textRef.current.material as any).depthWrite = false;
        textRef.current.renderOrder = renderOrder;
      }
    }
  });

  // Enhanced text processing with fallback mechanism
  useEffect(() => {
    const processText = async () => {
      console.log(`[ThreeDimensionalText] Processing text: "${text}", skipTranslation: ${skipTranslation}, language: ${currentLanguage}`);
      
      // Reset error state
      setRenderError(null);
      
      // Validate input text
      const validation = validateText(text);
      if (!validation.isValid) {
        console.warn(`[ThreeDimensionalText] Text validation failed: ${validation.reason}`);
        const fallback = generateFallbackText(text);
        setDisplayText(fallback);
        setFallbackText(fallback);
        return;
      }
      
      // If skipTranslation is true, use the text as-is
      if (skipTranslation) {
        setDisplayText(text);
        isNonLatinScript.current = containsNonLatinScript(text);
        isDevanagari.current = containsDevanagari(text);
        console.log(`[ThreeDimensionalText] Skipping translation for: "${text}"`);
        return;
      }

      // Use original text if English or no translation needed
      if (currentLanguage === 'en' || !text) {
        setDisplayText(text);
        isNonLatinScript.current = containsNonLatinScript(text);
        isDevanagari.current = containsDevanagari(text);
        return;
      }
      
      // Attempt translation with fallback
      try {
        console.log(`[ThreeDimensionalText] Attempting translation of: "${text}"`);
        const result = await translate(text);
        
        // Validate translated result
        const translatedValidation = validateText(result);
        if (!translatedValidation.isValid) {
          console.warn(`[ThreeDimensionalText] Translated text validation failed, using fallback`);
          const fallback = generateFallbackText(text);
          setDisplayText(fallback);
          setFallbackText(fallback);
          return;
        }
        
        setDisplayText(result);
        isNonLatinScript.current = containsNonLatinScript(result);
        isDevanagari.current = containsDevanagari(result);
        
        console.log(`[ThreeDimensionalText] Successfully translated "${text}" to "${result}"`);
        
        // Clear any previous fallback
        setFallbackText(null);
        retryCount.current = 0;
      } catch (error) {
        console.error('[ThreeDimensionalText] Translation error:', error);
        retryCount.current++;
        
        // Generate and use fallback text
        const fallback = generateFallbackText(text);
        setDisplayText(fallback);
        setFallbackText(fallback);
        isNonLatinScript.current = containsNonLatinScript(fallback);
        isDevanagari.current = containsDevanagari(fallback);
        
        console.log(`[ThreeDimensionalText] Using fallback text: "${fallback}" (retry ${retryCount.current})`);
      }
    };
    
    processText();
  }, [text, currentLanguage, translate, skipTranslation]);

  // Don't render if not visible or no valid text
  if (!visible || !displayText) {
    console.log(`[ThreeDimensionalText] Not rendering: visible=${visible}, displayText="${displayText}"`);
    return null;
  }

  // Enhanced sizing with better proportions
  const effectiveSize = size * 2.5;
  
  // Enhanced configuration based on script type
  const getTextConfig = () => {
    if (isDevanagari.current) {
      return {
        maxWidth: 80,
        letterSpacing: 0.15,
        lineHeight: 2.0,
        sdfGlyphSize: 512, // Higher resolution for complex scripts
        font: 'Noto Sans Devanagari'
      };
    } else if (isNonLatinScript.current) {
      return {
        maxWidth: 60,
        letterSpacing: 0.08,
        lineHeight: 1.8,
        sdfGlyphSize: 256,
        font: 'Noto Sans'
      };
    }
    return {
      maxWidth: 25,
      letterSpacing: 0.02,
      lineHeight: 1.4,
      sdfGlyphSize: 128,
      font: 'Inter'
    };
  };

  const textConfig = getTextConfig();
  
  console.log(`[ThreeDimensionalText] Rendering: "${displayText}" at position:`, position, 
    'config:', textConfig, 'fallback:', fallbackText, 'skipTranslation:', skipTranslation);
  
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
      maxWidth={textConfig.maxWidth}
      overflowWrap="normal"
      whiteSpace="normal"
      textAlign="center"
      letterSpacing={textConfig.letterSpacing}
      sdfGlyphSize={textConfig.sdfGlyphSize}
      renderOrder={renderOrder}
      lineHeight={textConfig.lineHeight}
      // Enhanced material properties for cross-script compatibility
      material-transparent={true}
      material-opacity={opacity}
      material-toneMapped={false}
      material-side={THREE.DoubleSide}
      material-depthTest={false}
      material-depthWrite={false}
      // Force font loading for better script support
      font={`/fonts/${textConfig.font}-Regular.woff`}
      onError={(error) => {
        console.error(`[ThreeDimensionalText] Render error for "${displayText}":`, error);
        setRenderError(error.message);
      }}
    >
      {displayText}
    </Text>
  );
};

export default ThreeDimensionalText;
