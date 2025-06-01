
import React, { useState, useEffect, useRef } from 'react';
import '@/types/three-reference';
import { Text } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useTranslation } from '@/contexts/TranslationContext';
import { fontService } from '@/utils/fontService';

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

// Enhanced text validation utility
const validateText = (text: string): { isValid: boolean; reason?: string } => {
  if (!text || typeof text !== 'string') {
    return { isValid: false, reason: 'Text is empty or not a string' };
  }
  
  if (text.trim().length === 0) {
    return { isValid: false, reason: 'Text is only whitespace' };
  }
  
  if (text.length > 300) {
    return { isValid: false, reason: 'Text is too long for 3D rendering' };
  }
  
  return { isValid: true };
};

// Enhanced fallback text generation
const generateFallbackText = (originalText: string): string => {
  if (!originalText) return 'Text';
  
  // Extract English words first
  const englishWords = originalText.match(/[a-zA-Z]+/g);
  if (englishWords && englishWords.length > 0) {
    return englishWords.slice(0, 2).join(' ');
  }
  
  // Take first 10 characters if no English words
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
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const { camera } = useThree();
  const textRef = useRef<THREE.Mesh>(null);
  const lastCameraPosition = useRef<THREE.Vector3>(new THREE.Vector3());
  const scriptTypeRef = useRef<string>('latin');
  const processingRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  
  // Enhanced billboarding with improved stability
  useFrame(() => {
    if (textRef.current && camera && visible && isReady && fontsLoaded) {
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

  // Font loading effect
  useEffect(() => {
    let mounted = true;
    
    const initializeFonts = async () => {
      try {
        console.log('[ThreeDimensionalText] Initializing fonts...');
        
        // Wait for font system to be ready
        await fontService.waitForFonts();
        
        if (mounted) {
          console.log('[ThreeDimensionalText] Fonts ready');
          setFontsLoaded(true);
        }
      } catch (error) {
        console.error('[ThreeDimensionalText] Font initialization error:', error);
        if (mounted) {
          setFontsLoaded(true); // Proceed anyway
        }
      }
    };
    
    initializeFonts();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Enhanced text processing with race condition prevention
  useEffect(() => {
    if (!fontsLoaded) {
      console.log('[ThreeDimensionalText] Fonts not ready, waiting...');
      return;
    }
    
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
            scriptTypeRef.current = fontService.detectScriptType(fallback);
            setIsReady(true);
          }
          return;
        }
        
        // If skipTranslation is true or English language, use text as-is
        if (skipTranslation || currentLanguage === 'en' || !text) {
          if (mountedRef.current) {
            setDisplayText(text);
            scriptTypeRef.current = fontService.detectScriptType(text);
            
            // Preload fonts for detected script
            await fontService.preloadFontsForScript(scriptTypeRef.current);
            
            setIsReady(true);
            console.log(`[ThreeDimensionalText] Using direct text: "${text}", detected script: ${scriptTypeRef.current}`);
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
              scriptTypeRef.current = fontService.detectScriptType(result);
              
              // Preload fonts for detected script
              await fontService.preloadFontsForScript(scriptTypeRef.current);
              
              console.log(`[ThreeDimensionalText] Successfully translated "${text}" to "${result}", detected script: ${scriptTypeRef.current}`);
            } else {
              console.warn(`[ThreeDimensionalText] Translated text validation failed, using original`);
              setDisplayText(text);
              scriptTypeRef.current = fontService.detectScriptType(text);
              
              // Preload fonts for original text
              await fontService.preloadFontsForScript(scriptTypeRef.current);
            }
            setIsReady(true);
          }
        } else if (mountedRef.current) {
          // Fallback if no translate function
          setDisplayText(text);
          scriptTypeRef.current = fontService.detectScriptType(text);
          
          // Preload fonts for detected script
          await fontService.preloadFontsForScript(scriptTypeRef.current);
          
          setIsReady(true);
        }
      } catch (error) {
        console.error('[ThreeDimensionalText] Text processing error:', error);
        if (mountedRef.current) {
          const fallback = generateFallbackText(text);
          setDisplayText(fallback);
          scriptTypeRef.current = fontService.detectScriptType(fallback);
          setIsReady(true);
        }
      } finally {
        processingRef.current = false;
      }
    };
    
    processText();
  }, [text, currentLanguage, translate, skipTranslation, fontsLoaded]);

  // Don't render until ready
  if (!visible || !displayText || !isReady || !fontsLoaded) {
    console.log(`[ThreeDimensionalText] Not rendering: visible=${visible}, displayText="${displayText}", isReady=${isReady}, fontsLoaded=${fontsLoaded}`);
    return null;
  }

  // Enhanced sizing with better proportions
  const effectiveSize = size * 2.8;
  
  // Enhanced configuration based on script type
  const getTextConfig = () => {
    const fontFamily = fontService.getOptimalFontFamily(scriptTypeRef.current);
    
    switch (scriptTypeRef.current) {
      case 'devanagari':
        return {
          maxWidth: 85,
          letterSpacing: 0.18,
          lineHeight: 2.1,
          sdfGlyphSize: 512,
          fontFamily
        };
      case 'arabic':
        return {
          maxWidth: 75,
          letterSpacing: 0.12,
          lineHeight: 2.0,
          sdfGlyphSize: 512,
          fontFamily
        };
      case 'chinese':
        return {
          maxWidth: 65,
          letterSpacing: 0.06,
          lineHeight: 1.9,
          sdfGlyphSize: 512,
          fontFamily
        };
      case 'japanese':
        return {
          maxWidth: 65,
          letterSpacing: 0.06,
          lineHeight: 1.9,
          sdfGlyphSize: 512,
          fontFamily
        };
      case 'korean':
        return {
          maxWidth: 65,
          letterSpacing: 0.06,
          lineHeight: 1.9,
          sdfGlyphSize: 512,
          fontFamily
        };
      case 'bengali':
      case 'tamil':
      case 'telugu':
      case 'gujarati':
      case 'kannada':
      case 'malayalam':
      case 'oriya':
      case 'gurmukhi':
        return {
          maxWidth: 75,
          letterSpacing: 0.12,
          lineHeight: 2.0,
          sdfGlyphSize: 512,
          fontFamily
        };
      case 'thai':
        return {
          maxWidth: 70,
          letterSpacing: 0.1,
          lineHeight: 1.95,
          sdfGlyphSize: 512,
          fontFamily
        };
      default:
        return {
          maxWidth: 28,
          letterSpacing: 0.03,
          lineHeight: 1.5,
          sdfGlyphSize: 256,
          fontFamily
        };
    }
  };

  const textConfig = getTextConfig();
  
  console.log(`[ThreeDimensionalText] Rendering stable: "${displayText}" with config:`, textConfig, 'script:', scriptTypeRef.current);
  
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
