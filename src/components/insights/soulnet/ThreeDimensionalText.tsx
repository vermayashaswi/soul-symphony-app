
import React, { useState, useEffect, useRef } from 'react';
import { Text } from '@react-three/drei';
import { useTranslation } from '@/contexts/TranslationContext';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

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

// Helper function to detect non-Latin script
const containsNonLatinScript = (text: string): boolean => {
  if (!text) return false;
  
  // Regex patterns for different script ranges
  const patterns = {
    devanagari: /[\u0900-\u097F]/,  // Hindi, Sanskrit, etc.
    arabic: /[\u0600-\u06FF]/,      // Arabic
    chinese: /[\u4E00-\u9FFF]/,     // Chinese
    japanese: /[\u3040-\u309F\u30A0-\u30FF]/,  // Japanese Hiragana and Katakana
    korean: /[\uAC00-\uD7AF]/,      // Korean Hangul
    cyrillic: /[\u0400-\u04FF]/     // Russian and other Cyrillic
  };
  
  // Check if text contains any non-Latin script
  return Object.values(patterns).some(pattern => pattern.test(text));
};

// Specifically detect Devanagari script (Hindi)
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
}) => {
  const { translate, currentLanguage } = useTranslation();
  const [translatedText, setTranslatedText] = useState(text);
  const { camera } = useThree();
  const textRef = useRef<THREE.Mesh>(null);
  const isNonLatinScript = useRef<boolean>(false);
  const isDevanagari = useRef<boolean>(false);
  const lastTranslation = useRef<string>(text);
  const [textReady, setTextReady] = useState<boolean>(false);
  
  // Detect script type on first render and when text changes
  useEffect(() => {
    if (translatedText) {
      const hasDevanagari = containsDevanagari(translatedText);
      const hasNonLatin = containsNonLatinScript(translatedText) || hasDevanagari;
      
      isNonLatinScript.current = hasNonLatin;
      isDevanagari.current = hasDevanagari;
      
      // Set text as ready immediately for all languages
      setTextReady(true);
    }
  }, [translatedText]);
  
  // Enhanced billboarding - always update EVERY frame for ALL text types
  useFrame(() => {
    if (textRef.current && camera && visible) {
      // Make text always face the camera
      textRef.current.quaternion.copy(camera.quaternion);
    }
  });

  // Handle translation for all languages consistently
  useEffect(() => {
    const translateText = async () => {
      if (!text) {
        setTranslatedText('');
        return;
      }
      
      // Avoid unnecessary translations
      if (currentLanguage === 'en') {
        setTranslatedText(text);
        setTextReady(true);
        return;
      }
      
      // Skip retranslation if text hasn't changed
      if (text === lastTranslation.current && translatedText) {
        setTextReady(true);
        return;
      }
      
      try {
        const result = await translate(text);
        
        if (result) {
          setTranslatedText(result);
          lastTranslation.current = text;
          
          // Update script detection after translation
          isNonLatinScript.current = containsNonLatinScript(result);
          isDevanagari.current = containsDevanagari(result);
        } else {
          // Fallback to original text
          setTranslatedText(text);
        }
      } catch (e) {
        console.error('Translation error:', e);
        // Fallback to original text on error
        setTranslatedText(text);
      } finally {
        // Always set text as ready at the end
        setTextReady(true);
      }
    };
    
    translateText();
  }, [text, currentLanguage, translate]);

  // Don't render if we're not supposed to be visible
  if (!visible) return null;

  // Also don't render if there's no text
  if (!text && !translatedText) return null;

  // Calculate appropriate max width based on script type and text length
  const getMaxWidth = () => {
    if (isDevanagari.current) {
      return 60; // Wider container for Devanagari
    } else if (isNonLatinScript.current) {
      return 40; // Wider container for other non-Latin scripts
    }
    return 20; // Standard width for Latin scripts
  };

  // Get font family appropriate for the script
  const getFont = () => {
    if (isDevanagari.current) {
      return 'Noto Sans Devanagari';
    }
    return undefined; // Use default font for other scripts
  };

  // Get letter spacing appropriate for the script
  const getLetterSpacing = () => {
    if (isDevanagari.current) {
      return 0.15; // Increased spacing for Devanagari
    } else if (isNonLatinScript.current) {
      return 0.05; // Some spacing for other non-Latin scripts
    }
    return 0.02; // Slightly increased for Latin scripts too
  };

  // Apply consistent rendering settings for all languages
  const glyphSize = isDevanagari.current ? 128 : 96;
  const lineHeight = isDevanagari.current ? 1.8 : (isNonLatinScript.current ? 1.5 : 1.3);
  const renderOrder = isDevanagari.current ? 10 : 5;

  // If text is not ready yet, display nothing to prevent rendering artifacts
  if (!textReady) {
    return null;
  }

  return (
    <group>
      <Text
        ref={textRef}
        position={position}
        color={color}
        fontSize={size}
        fontWeight={bold ? 700 : 400}
        font={getFont()}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.008}
        outlineColor="#000000"
        outlineOpacity={0.9}
        maxWidth={getMaxWidth()}
        overflowWrap="normal" 
        whiteSpace="normal"
        textAlign="center"
        letterSpacing={getLetterSpacing()}
        sdfGlyphSize={glyphSize} 
        clipRect={[-1000, -1000, 2000, 2000]}
        renderOrder={renderOrder} 
        lineHeight={lineHeight}
        // Include common characters for pre-caching
        characters="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:',.<>/?`~ áéíóúÁÉÍÓÚñÑüÜ¿¡"
      >
        {translatedText || text}
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
          depthWrite={true}
        />
      </Text>
    </group>
  );
};

export default ThreeDimensionalText;
