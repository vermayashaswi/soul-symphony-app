
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
  const lastUpdateTime = useRef<number>(0);
  const isNonLatinScript = useRef<boolean>(false);
  const isDevanagari = useRef<boolean>(false);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [textReady, setTextReady] = useState<boolean>(false);
  
  // Detect script type on first render and when text changes
  useEffect(() => {
    if (translatedText) {
      const hasDevanagari = containsDevanagari(translatedText);
      const hasNonLatin = containsNonLatinScript(translatedText) || hasDevanagari;
      
      isNonLatinScript.current = hasNonLatin;
      isDevanagari.current = hasDevanagari;
      
      if (hasDevanagari) {
        console.log(`Hindi/Devanagari text detected: "${translatedText}", applying optimizations`);
      }
    }
    
    setTextReady(true); // Mark text as ready to render regardless of script
    
    // Set a timeout to ensure we proceed even if something gets stuck
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
    }
    loadingTimerRef.current = setTimeout(() => {
      if (!textReady) {
        console.log("Force setting text ready after timeout");
        setTextReady(true);
      }
    }, 500);
    
    // Cleanup the timer
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [translatedText, textReady]);
  
  // Enhanced billboarding - always update EVERY frame for ALL text types for consistency
  useFrame(() => {
    if (textRef.current && camera && visible) {
      // Make text always face the camera for all language types
      textRef.current.quaternion.copy(camera.quaternion);
      lastUpdateTime.current = Date.now();
    }
  });

  useEffect(() => {
    const translateText = async () => {
      if (currentLanguage !== 'en' && text) {
        try {
          console.log(`Translating text "${text}" to ${currentLanguage}`);
          const result = await translate(text);
          
          if (result) {
            setTranslatedText(result);
            console.log(`Translation complete: "${result}"`);
            
            // Detect script after translation
            isNonLatinScript.current = containsNonLatinScript(result);
            isDevanagari.current = containsDevanagari(result);
            
            if (isDevanagari.current) {
              console.log(`Hindi/Devanagari translation: "${result}", adjusting rendering parameters`);
            }
          } else {
            console.log(`No translation returned for "${text}", using original text`);
            setTranslatedText(text);
          }
        } catch (e) {
          console.error('Translation error:', e);
          // Fallback to original text on error
          setTranslatedText(text);
        }
      } else {
        console.log(`Using original ${currentLanguage === 'en' ? 'English' : ''} text: "${text}"`);
        setTranslatedText(text);
        
        // Check for non-Latin script in original text as well
        isNonLatinScript.current = containsNonLatinScript(text);
        isDevanagari.current = containsDevanagari(text);
      }
      
      // Ensure text is ready for rendering
      setTextReady(true);
    };
    
    translateText();
  }, [text, currentLanguage, translate]);

  if (!visible || !text) return null;

  // Calculate appropriate max width based on script type and text length
  const getMaxWidth = () => {
    if (isDevanagari.current) {
      // Much wider container for Devanagari specifically
      return 60; // Further increased to accommodate Devanagari's wider character set
    } else if (isNonLatinScript.current) {
      // Wider container for other non-Latin scripts
      return 30;
    }
    // Standard width for Latin scripts, but increased slightly for better consistency
    return 15; // Increased from 10 to 15 for more room for all languages
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
    // Slightly increased for Latin scripts too
    return 0.02; // Was 0, now 0.02 for better readability
  };

  // Set higher resolution for all text
  const getGlyphSize = () => {
    if (isDevanagari.current) {
      return 128; // Higher resolution for Devanagari 
    }
    return 96; // Increased from 64 to 96 for all other languages
  };

  // Increase render order priority for all text for consistency
  const getRenderOrder = () => {
    if (isDevanagari.current) {
      return 10; // Higher priority for Devanagari
    }
    return 5; // Increased from 1 to 5 for other text
  };

  // Adjusted line height for different scripts
  const getLineHeight = () => {
    if (isDevanagari.current) {
      return 1.8; // Taller for Devanagari
    } else if (isNonLatinScript.current) {
      return 1.5; // Taller for other non-Latin
    }
    return 1.3; // Standard for Latin (slightly increased)
  };

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
        outlineWidth={0.008} // Increased outline for better readability
        outlineColor="#000000"
        outlineOpacity={0.9}
        maxWidth={getMaxWidth()}
        overflowWrap="normal" // Prevent syllable breaks
        whiteSpace="normal" // Allow wrapping for better display of non-Latin text
        textAlign="center"
        letterSpacing={getLetterSpacing()}
        sdfGlyphSize={getGlyphSize()} 
        clipRect={[-1000, -1000, 2000, 2000]} // Reduce rendering artifacts
        renderOrder={getRenderOrder()} 
        lineHeight={getLineHeight()}
        // Special settings for Devanagari text
        userData={{ 
          isDevanagari: isDevanagari.current,
          isNonLatinScript: isNonLatinScript.current,
          language: currentLanguage
        }}
        // Include common characters for pre-caching
        characters={isDevanagari.current ? 
          "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:',.<>/?`~ ।॥॰॥०१२३४५६७८९अआइईउऊएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसहक्षत्रज्ञड़ढ़" : 
          "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:',.<>/?`~ áéíóúÁÉÍÓÚñÑüÜ¿¡"
        }
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
          depthWrite={true} // Enable depth writing to fix z-fighting issues
        />
      </Text>
    </group>
  );
};

export default ThreeDimensionalText;
