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

// Get the appropriate font for the text
const getFontFamily = (text: string): string => {
  if (containsDevanagari(text)) {
    return 'Noto Sans Devanagari, Mukta';
  } else if (containsNonLatinScript(text)) {
    return 'Noto Sans';
  }
  return undefined; // Use default font
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
  const isNonLatinScript = useRef<boolean>(false);
  const isDevanagari = useRef<boolean>(false);
  const cameraUpdateThrottleRef = useRef<number>(0);
  const textStabilityCounter = useRef<number>(0);
  const renderPriorityRef = useRef<number>(1);
  
  // First render priority boost for Devanagari text
  useEffect(() => {
    if (containsDevanagari(text)) {
      renderPriorityRef.current = 10; // Higher priority for Devanagari
      console.log(`Boosting render priority for Devanagari text: "${text}"`);
    }
  }, [text]);
  
  // Use a separate check for Devanagari to apply specific optimizations
  useEffect(() => {
    if (translatedText) {
      isNonLatinScript.current = containsNonLatinScript(translatedText);
      isDevanagari.current = containsDevanagari(translatedText);
      
      // Debug logging for Hindi text
      if (isDevanagari.current) {
        console.log(`Hindi text detected: "${translatedText}", applying optimizations`);
        if (textRef.current) {
          // Increase priority for Hindi text rendering
          textRef.current.renderOrder = 5;
        }
      }
    }
  }, [translatedText]);
  
  // Enhanced billboarding with quaternion stabilization
  useFrame(() => {
    if (textRef.current && camera && visible) {
      // Update every few frames, more frequently for Devanagari
      const updateInterval = isDevanagari.current ? 2 : 5;
      
      cameraUpdateThrottleRef.current++;
      if (cameraUpdateThrottleRef.current > updateInterval) {
        const distanceMoved = camera.position.distanceTo(lastCameraPosition.current);
        
        // More sensitive updates for Devanagari
        const movementThreshold = isDevanagari.current ? 0.02 : 0.05;
        
        // Only update orientation if camera moved enough, or for Devanagari script
        // which needs more frequent updates for better visibility
        if (distanceMoved > movementThreshold || isDevanagari.current) {
          // For billboarding: make text always face the camera using quaternion
          // This is more stable than lookAt for text rendering
          textRef.current.quaternion.copy(camera.quaternion);
          
          // For Devanagari text, use specific orientation to maximize readability
          if (isDevanagari.current) {
            // Apply slight Y-axis rotation to improve readability
            textRef.current.quaternion.multiply(
              new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0), 
                textStabilityCounter.current % 2 === 0 ? 0.01 : -0.01
              )
            );
            textStabilityCounter.current++;
          }
          
          // Save camera position for next comparison
          lastCameraPosition.current.copy(camera.position);
        }
        
        cameraUpdateThrottleRef.current = 0;
      }
    }
  });

  useEffect(() => {
    const translateText = async () => {
      if (currentLanguage !== 'en' && text) {
        try {
          const result = await translate(text);
          if (result) {
            setTranslatedText(result);
            
            // Detect script after translation
            isNonLatinScript.current = containsNonLatinScript(result);
            isDevanagari.current = containsDevanagari(result);
            
            // Debug logging for Hindi text
            if (isDevanagari.current) {
              console.log(`Hindi translation: "${result}", adjusting rendering parameters`);
            }
          }
        } catch (e) {
          console.error('Translation error:', e);
        }
      } else {
        setTranslatedText(text);
        
        // Check for non-Latin script in original text as well
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
      return 35; // Further increased to accommodate Devanagari's wider character set
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
      return 0.05; // Reduced spacing for Devanagari (was 0.12)
    } else if (isNonLatinScript.current) {
      return 0.05; // Some spacing for other non-Latin scripts
    }
    return 0; // Default spacing for Latin scripts
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
        outlineWidth={0.0045} // Increased outline for better readability
        outlineColor="#000000"
        maxWidth={getMaxWidth()}
        overflowWrap="normal" // Prevent syllable breaks
        whiteSpace="normal" // Allow wrapping for better display of non-Latin text
        textAlign="center"
        // Add extra letter spacing for non-Latin scripts for better legibility
        letterSpacing={getLetterSpacing()}
        // Improve rendering quality
        sdfGlyphSize={isDevanagari.current ? 128 : 64} // Higher resolution for Devanagari
        // Reduce rendering artifacts
        clipRect={[-1000, -1000, 2000, 2000]}
        // Add throttling to prevent too many redraws
        renderOrder={isDevanagari.current ? 5 : 1} // Higher render order for Hindi
        // Add lineHeight for better vertical spacing
        lineHeight={isDevanagari.current ? 1.7 : (isNonLatinScript.current ? 1.5 : 1.2)}
        // Font subsetting optimization - more character support
        font={fontFamily} // Use specialized font for better glyph support
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
