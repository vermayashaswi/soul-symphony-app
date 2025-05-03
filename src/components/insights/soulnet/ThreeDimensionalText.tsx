
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
  size = 1.2, // Decreased by 30% from 1.7 to 1.2
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
  const isNonLatinScript = useRef<boolean>(false);
  const isDevanagari = useRef<boolean>(false);
  
  // Update text orientation only when camera has moved significantly
  useFrame(() => {
    if (textRef.current && camera) {
      // Calculate distance camera has moved
      const distanceMoved = camera.position.distanceTo(lastCameraPosition.current);
      
      // Only update orientation if camera moved enough (reduces jitter)
      if (distanceMoved > 0.05) {
        textRef.current.lookAt(camera.position);
        lastCameraPosition.current.copy(camera.position);
      }
    }
  });
  
  // Check if the text contains non-Latin characters
  useEffect(() => {
    if (translatedText) {
      isNonLatinScript.current = containsNonLatinScript(translatedText);
      isDevanagari.current = containsDevanagari(translatedText);
    }
  }, [translatedText]);
  
  useEffect(() => {
    const translateText = async () => {
      if (currentLanguage !== 'en' && text) {
        try {
          const result = await translate(text);
          if (result) {
            setTranslatedText(result);
            // Check for non-Latin script after translation
            isNonLatinScript.current = containsNonLatinScript(result);
            isDevanagari.current = containsDevanagari(result);
          }
        } catch (e) {
          console.error('Translation error:', e);
        }
      } else {
        setTranslatedText(text);
        // Check for non-Latin script for original text too
        isNonLatinScript.current = containsNonLatinScript(text);
        isDevanagari.current = containsDevanagari(text);
      }
    };
    
    translateText();
  }, [text, currentLanguage, translate]);

  if (!visible || !text) return null;

  // Calculate appropriate max width based on script type and text length
  const getMaxWidth = () => {
    if (isDevanagari.current) {
      // Much wider container for Devanagari specifically
      return 30;
    } else if (isNonLatinScript.current) {
      // Wider container for other non-Latin scripts
      return 25;
    }
    // Standard width for Latin scripts
    return 10;
  };

  // Get letter spacing appropriate for the script
  const getLetterSpacing = () => {
    if (isDevanagari.current) {
      return 0.1; // More spacing for Devanagari
    } else if (isNonLatinScript.current) {
      return 0.05; // Some spacing for other non-Latin scripts
    }
    return 0; // Default spacing for Latin scripts
  };

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
        outlineWidth={0.0045} // Increased outline for better readability
        outlineColor="#000000"
        maxWidth={getMaxWidth()}
        overflowWrap="normal" // Prevent syllable breaks
        whiteSpace="normal" // Allow wrapping for better display of non-Latin text
        textAlign="center"
        // Use a rotation that will be updated by useFrame
        rotation={[0, 0, 0]}
        // Add extra letter spacing for non-Latin scripts for better legibility
        letterSpacing={getLetterSpacing()}
        // Improve rendering quality
        sdfGlyphSize={64}
        // Reduce rendering artifacts
        clipRect={[-1000, -1000, 2000, 2000]}
        // Add throttling to prevent too many redraws
        renderOrder={1}
        // Add lineHeight for better vertical spacing
        lineHeight={isNonLatinScript.current ? 1.5 : 1.2}
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

export default ThreeDimensionalText;
