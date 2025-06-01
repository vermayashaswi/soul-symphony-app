
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

// Detect specific script type for font selection
const detectScriptType = (text: string): string => {
  if (!text) return 'latin';
  
  if (/[\u0900-\u097F]/.test(text)) return 'devanagari';
  if (/[\u0600-\u06FF]/.test(text)) return 'arabic';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'chinese';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'japanese';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'korean';
  if (/[\u0980-\u09FF]/.test(text)) return 'bengali';
  if (/[\u0E00-\u0E7F]/.test(text)) return 'thai';
  
  return 'latin';
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
  
  const englishWords = originalText.match(/[a-zA-Z]+/g);
  if (englishWords && englishWords.length > 0) {
    return englishWords.slice(0, 2).join(' ');
  }
  
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
  const [isReady, setIsReady] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const { camera } = useThree();
  const textRef = useRef<THREE.Mesh>(null);
  const lastCameraPosition = useRef<THREE.Vector3>(new THREE.Vector3());
  const scriptType = useRef<string>(detectScriptType(text));
  const processingRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  
  // Enhanced billboarding with improved stability
  useFrame(() => {
    if (textRef.current && camera && visible && isReady) {
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Optimized text processing with race condition prevention
  useEffect(() => {
    if (processingRef.current) {
      console.log(`[ThreeDimensionalText] Processing already in progress for: "${text}"`);
      return;
    }
    
    const processText = async () => {
      if (!mountedRef.current) return;
      
      processingRef.current = true;
      setIsReady(false);
      setRenderError(null);
      
      try {
        console.log(`[ThreeDimensionalText] Processing text: "${text}", skipTranslation: ${skipTranslation}, language: ${currentLanguage}`);
        
        // Validate input text
        const validation = validateText(text);
        if (!validation.isValid) {
          console.warn(`[ThreeDimensionalText] Text validation failed: ${validation.reason}`);
          const fallback = generateFallbackText(text);
          if (mountedRef.current) {
            setDisplayText(fallback);
            scriptType.current = detectScriptType(fallback);
            setIsReady(true);
          }
          return;
        }
        
        // If skipTranslation is true or English language, use text as-is
        if (skipTranslation || currentLanguage === 'en' || !text) {
          if (mountedRef.current) {
            setDisplayText(text);
            scriptType.current = detectScriptType(text);
            setIsReady(true);
            console.log(`[ThreeDimensionalText] Using direct text: "${text}", detected script: ${scriptType.current}`);
          }
          return;
        }
        
        // Attempt translation with enhanced error handling
        if (translate && mountedRef.current) {
          console.log(`[ThreeDimensionalText] Attempting translation of: "${text}"`);
          const result = await translate(text);
          
          if (mountedRef.current) {
            const translatedValidation = validateText(result);
            if (translatedValidation.isValid) {
              setDisplayText(result);
              scriptType.current = detectScriptType(result);
              console.log(`[ThreeDimensionalText] Successfully translated "${text}" to "${result}", detected script: ${scriptType.current}`);
            } else {
              console.warn(`[ThreeDimensionalText] Translated text validation failed, using original`);
              setDisplayText(text);
              scriptType.current = detectScriptType(text);
            }
            setIsReady(true);
          }
        } else if (mountedRef.current) {
          // Fallback if no translate function
          setDisplayText(text);
          scriptType.current = detectScriptType(text);
          setIsReady(true);
        }
      } catch (error) {
        console.error('[ThreeDimensionalText] Text processing error:', error);
        if (mountedRef.current) {
          const fallback = generateFallbackText(text);
          setDisplayText(fallback);
          scriptType.current = detectScriptType(fallback);
          setIsReady(true);
        }
      } finally {
        processingRef.current = false;
      }
    };
    
    processText();
  }, [text, currentLanguage, translate, skipTranslation]);

  // Don't render until ready
  if (!visible || !displayText || !isReady) {
    console.log(`[ThreeDimensionalText] Not rendering: visible=${visible}, displayText="${displayText}", isReady=${isReady}`);
    return null;
  }

  // Enhanced sizing with better proportions
  const effectiveSize = size * 2.8;
  
  // Enhanced configuration based on script type
  const getTextConfig = () => {
    switch (scriptType.current) {
      case 'devanagari':
        return {
          maxWidth: 85,
          letterSpacing: 0.18,
          lineHeight: 2.1,
          sdfGlyphSize: 512,
          fontFamily: 'Noto Sans Devanagari, Noto Sans, Inter, system-ui, sans-serif'
        };
      case 'arabic':
        return {
          maxWidth: 75,
          letterSpacing: 0.12,
          lineHeight: 2.0,
          sdfGlyphSize: 512,
          fontFamily: 'Noto Sans Arabic, Noto Sans, Inter, system-ui, sans-serif'
        };
      case 'chinese':
        return {
          maxWidth: 65,
          letterSpacing: 0.06,
          lineHeight: 1.9,
          sdfGlyphSize: 512,
          fontFamily: 'Noto Sans SC, Noto Sans, Inter, system-ui, sans-serif'
        };
      case 'japanese':
        return {
          maxWidth: 65,
          letterSpacing: 0.06,
          lineHeight: 1.9,
          sdfGlyphSize: 512,
          fontFamily: 'Noto Sans JP, Noto Sans, Inter, system-ui, sans-serif'
        };
      case 'korean':
        return {
          maxWidth: 65,
          letterSpacing: 0.06,
          lineHeight: 1.9,
          sdfGlyphSize: 512,
          fontFamily: 'Noto Sans KR, Noto Sans, Inter, system-ui, sans-serif'
        };
      case 'bengali':
        return {
          maxWidth: 75,
          letterSpacing: 0.12,
          lineHeight: 2.0,
          sdfGlyphSize: 512,
          fontFamily: 'Noto Sans Bengali, Noto Sans, Inter, system-ui, sans-serif'
        };
      case 'thai':
        return {
          maxWidth: 70,
          letterSpacing: 0.1,
          lineHeight: 1.95,
          sdfGlyphSize: 512,
          fontFamily: 'Noto Sans Thai, Noto Sans, Inter, system-ui, sans-serif'
        };
      default:
        return {
          maxWidth: 28,
          letterSpacing: 0.03,
          lineHeight: 1.5,
          sdfGlyphSize: 256,
          fontFamily: 'Inter, Noto Sans, system-ui, sans-serif'
        };
    }
  };

  const textConfig = getTextConfig();
  
  console.log(`[ThreeDimensionalText] Rendering stable: "${displayText}" with config:`, textConfig, 'script:', scriptType.current);
  
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
      material-transparent={true}
      material-opacity={opacity}
      material-toneMapped={false}
      material-side={THREE.DoubleSide}
      material-depthTest={false}
      material-depthWrite={false}
      font={textConfig.fontFamily}
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
