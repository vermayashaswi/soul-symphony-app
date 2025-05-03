
import React, { useRef, useEffect, useState } from 'react';
import { Text } from 'troika-three-text';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TroikaTextProps {
  text: string;
  position: [number, number, number];
  color: string;
  size: number;
  bold?: boolean;
  visible?: boolean;
  opacity?: number;
  isNonLatin?: boolean;
  isDevanagari?: boolean;
}

// Helper function to detect script types
const containsDevanagari = (text: string): boolean => {
  if (!text) return false;
  return /[\u0900-\u097F]/.test(text);
};

const containsNonLatin = (text: string): boolean => {
  if (!text) return false;
  const patterns = {
    devanagari: /[\u0900-\u097F]/,  // Hindi, Sanskrit, etc.
    arabic: /[\u0600-\u06FF]/,      // Arabic
    chinese: /[\u4E00-\u9FFF]/,     // Chinese
    japanese: /[\u3040-\u309F\u30A0-\u30FF]/,  // Japanese Hiragana and Katakana
    korean: /[\uAC00-\uD7AF]/,      // Korean Hangul
    cyrillic: /[\u0400-\u04FF]/     // Russian and other Cyrillic
  };
  
  return Object.values(patterns).some(pattern => pattern.test(text));
};

const TroikaText: React.FC<TroikaTextProps> = ({ 
  text,
  position,
  color,
  size,
  bold = false,
  visible = true,
  opacity = 1.0,
  isNonLatin: providedIsNonLatin,
  isDevanagari: providedIsDevanagari
}) => {
  const textRef = useRef<Text>();
  const { camera } = useThree();
  const [initialized, setInitialized] = useState(false);
  
  // Determine script type if not provided
  const isNonLatin = providedIsNonLatin !== undefined ? providedIsNonLatin : containsNonLatin(text);
  const isDevanagari = providedIsDevanagari !== undefined ? providedIsDevanagari : containsDevanagari(text);

  useEffect(() => {
    if (textRef.current) {
      // Configure text properties
      textRef.current.text = text || '';
      textRef.current.fontSize = size;
      textRef.current.color = new THREE.Color(color);
      textRef.current.font = isDevanagari ? '/fonts/NotoSansDevanagari-Regular.woff' : undefined;
      textRef.current.anchorX = 'center';
      textRef.current.anchorY = 'middle';
      textRef.current.maxWidth = isDevanagari ? 35 : 28; // Larger max width for Devanagari
      textRef.current.lineHeight = isDevanagari ? 1.3 : 1.15; // Increased line height for Devanagari
      textRef.current.fontWeight = bold ? 700 : 400;
      textRef.current.material.opacity = visible ? opacity : 0;
      textRef.current.material.transparent = true;
      textRef.current.material.depthWrite = false;
      textRef.current.sdfGlyphSize = isNonLatin ? 12 : 8; // Higher SDF quality for non-Latin
      textRef.current.sync();
    }
  }, [text, color, size, bold, visible, opacity, isNonLatin, isDevanagari]);

  // Make text face camera (billboarding)
  useFrame(() => {
    if (textRef.current && camera) {
      textRef.current.quaternion.copy(camera.quaternion);
      
      // Ensure text is visible after initialization
      if (!initialized) {
        textRef.current.sync();
        setInitialized(true);
      }
    }
  });

  return (
    <group position={position}>
      <primitive object={new Text()} ref={textRef} />
    </group>
  );
};

export default TroikaText;
