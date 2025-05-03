
import React, { useState, useEffect, useRef } from 'react';
import { Text } from '@react-three/drei';
import { useTranslation } from '@/contexts/TranslationContext';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useFontLoading } from '../../../main';

interface ThreeDimensionalTextProps {
  text: string;
  position: [number, number, number]; 
  color?: string;
  size?: number;
  bold?: boolean;
  backgroundColor?: string;
  opacity?: number;
  visible?: boolean;
}

// Helper function to detect script types - consolidated into one function
const detectScriptType = (text: string): { isNonLatin: boolean, isDevanagari: boolean } => {
  if (!text) return { isNonLatin: false, isDevanagari: false };
  
  // Regex patterns for different script ranges
  const devanagariPattern = /[\u0900-\u097F]/;  // Hindi, Sanskrit, etc.
  
  // Non-Latin scripts
  const nonLatinPatterns = {
    arabic: /[\u0600-\u06FF]/,      // Arabic
    chinese: /[\u4E00-\u9FFF]/,     // Chinese
    japanese: /[\u3040-\u309F\u30A0-\u30FF]/,  // Japanese Hiragana and Katakana
    korean: /[\uAC00-\uD7AF]/,      // Korean Hangul
    cyrillic: /[\u0400-\u04FF]/,    // Russian and other Cyrillic
    thai: /[\u0E00-\u0E7F]/,        // Thai
    hebrew: /[\u0590-\u05FF]/,      // Hebrew
    greek: /[\u0370-\u03FF]/        // Greek
  };
  
  const isDevanagari = devanagariPattern.test(text);
  const isNonLatin = isDevanagari || Object.values(nonLatinPatterns).some(pattern => pattern.test(text));
  
  return { isNonLatin, isDevanagari };
};

// Get the appropriate font for the text
const getFontFamily = (text: string): string | undefined => {
  const { isDevanagari } = detectScriptType(text);
  
  if (isDevanagari) {
    return 'Noto Sans Devanagari, Mukta, sans-serif';
  }
  
  // Use Noto Sans for all other scripts as a robust Unicode font
  return 'Noto Sans, sans-serif';
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
}) => {
  const { translate, currentLanguage } = useTranslation();
  const [translatedText, setTranslatedText] = useState(text);
  const { camera } = useThree();
  const textRef = useRef<THREE.Mesh>(null);
  const lastCameraPosition = useRef<THREE.Vector3>(new THREE.Vector3());
  const updateCounterRef = useRef<number>(0);
  const [scriptType, setScriptType] = useState<{ isNonLatin: boolean, isDevanagari: boolean }>({ 
    isNonLatin: false, 
    isDevanagari: false 
  });
  const [renderError, setRenderError] = useState<boolean>(false);
  
  // Try to access the font loading context
  const fontStatus = useFontLoading ? useFontLoading() : { 
    fontsLoaded: true, 
    fontsError: false,
    devanagariReady: true 
  };
  
  // Use a single consistent update interval for all scripts
  const UPDATE_INTERVAL = 3; // Update every 3 frames for all scripts
  
  // Check if we should use 2D fallback for complex scripts
  const shouldUse2DFallback = () => {
    // Use 2D fallback if:
    // 1. We're dealing with Devanagari text
    // 2. And either the font isn't ready or we've already encountered a render error
    return scriptType.isDevanagari && 
           (!fontStatus.devanagariReady || renderError || fontStatus.fontsError);
  };
  
  // Detect script type when text changes
  useEffect(() => {
    if (translatedText) {
      const detected = detectScriptType(translatedText);
      setScriptType(detected);
      
      // Reset render error state when text changes
      setRenderError(false);
    }
  }, [translatedText]);
  
  // Consistent billboarding for all scripts with error handling
  useFrame(() => {
    try {
      if (textRef.current && camera && visible && !shouldUse2DFallback()) {
        // Use same update logic for all scripts
        updateCounterRef.current++;
        
        if (updateCounterRef.current >= UPDATE_INTERVAL) {
          // Apply consistent quaternion-based billboarding
          textRef.current.quaternion.copy(camera.quaternion);
          
          // Store camera position
          lastCameraPosition.current.copy(camera.position);
          updateCounterRef.current = 0;
        }
      }
    } catch (error) {
      console.error("Error in ThreeDimensionalText useFrame:", error);
      setRenderError(true);
    }
  });

  // Translation effect
  useEffect(() => {
    const translateText = async () => {
      if (!text) return;
      
      try {
        if (currentLanguage !== 'en') {
          const result = await translate(text);
          if (result) {
            setTranslatedText(result);
          }
        } else {
          setTranslatedText(text);
        }
      } catch (error) {
        console.error('Translation error:', error);
        // Fallback to original text on error
        setTranslatedText(text);
      }
    };
    
    translateText();
  }, [text, currentLanguage, translate]);

  // Skip rendering if not visible or empty text
  if (!visible || !text) return null;
  
  // Use 2D fallback for Devanagari when necessary
  if (shouldUse2DFallback()) {
    // Return a simple HTML-based canvas object in 3D space instead of drei Text
    return (
      <group position={position}>
        <sprite scale={[size * 4, size * 2, 1]}>
          <spriteMaterial transparent opacity={opacity}>
            <canvasTexture attach="map" args={[createTextCanvas(translatedText, color, bold)]} />
          </spriteMaterial>
        </sprite>
      </group>
    );
  }

  // Calculate appropriate max width based on script type
  const getMaxWidth = () => {
    if (scriptType.isDevanagari) {
      return 35;
    } else if (scriptType.isNonLatin) {
      return 25;
    }
    return 10;
  };

  // Get letter spacing appropriate for the script type
  const getLetterSpacing = () => {
    if (scriptType.isDevanagari) {
      return 0.05;
    } else if (scriptType.isNonLatin) {
      return 0.05;
    }
    return 0;
  };

  // Use standardized line height settings
  const getLineHeight = () => {
    if (scriptType.isDevanagari) {
      return 1.7;
    } else if (scriptType.isNonLatin) {
      return 1.5;
    }
    return 1.2;
  };

  // Get SDF glyph size - higher for complex scripts
  const getSdfGlyphSize = () => {
    if (scriptType.isDevanagari || scriptType.isNonLatin) {
      return 128;
    }
    return 64;
  };

  const fontFamily = getFontFamily(translatedText);

  return (
    <group>
      <Text
        ref={textRef}
        position={position}
        color={color}
        fontSize={size}
        fontWeight={bold ? 700 : 400}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.0045}
        outlineColor="#000000"
        maxWidth={getMaxWidth()}
        overflowWrap="normal"
        whiteSpace="normal"
        textAlign="center"
        letterSpacing={getLetterSpacing()}
        sdfGlyphSize={getSdfGlyphSize()}
        clipRect={[-1000, -1000, 2000, 2000]}
        renderOrder={5} // Use consistent high render order for all text
        lineHeight={getLineHeight()}
        font={fontFamily}
        onSync={(e) => {
          if (e.error) {
            console.error("Text sync error:", e.error);
            setRenderError(true);
          }
        }}
      >
        {translatedText}
        {backgroundColor && (
          <meshBasicMaterial
            color={backgroundColor}
            transparent={true}
            opacity={0.7}
            attach="material"
          />
        )}
        <meshBasicMaterial 
          color={color}
          transparent={true}
          opacity={opacity}
          toneMapped={false}
        />
      </Text>
    </group>
  );
};

// Helper function to create a canvas with text
function createTextCanvas(text: string, color: string, bold: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  
  // Set canvas size
  canvas.width = 256;
  canvas.height = 128;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Set text properties
  ctx.fillStyle = color;
  ctx.font = `${bold ? 'bold' : 'normal'} 24px 'Noto Sans Devanagari', 'Mukta', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Add text
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  
  return canvas;
}

export default ThreeDimensionalText;
