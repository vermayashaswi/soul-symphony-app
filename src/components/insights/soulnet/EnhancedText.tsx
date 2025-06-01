
import React, { useState, useEffect, useRef } from 'react';
import { Text } from '@react-three/drei';
import { useFrame, useLoader } from '@react-three/fiber';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import * as THREE from 'three';
import { threejsFontService } from '@/services/threejsFontService';

interface EnhancedTextProps {
  text: string;
  position: [number, number, number];
  color?: string;
  size?: number;
  visible?: boolean;
  renderOrder?: number;
  bold?: boolean;
  outlineWidth?: number;
  outlineColor?: string;
  maxWidth?: number;
}

export const EnhancedText: React.FC<EnhancedTextProps> = ({
  text,
  position,
  color = '#ffffff',
  size = 0.4,
  visible = true,
  renderOrder = 10,
  bold = false,
  outlineWidth = 0.02,
  outlineColor = '#000000',
  maxWidth = 25
}) => {
  const [isReady, setIsReady] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [fontUrl, setFontUrl] = useState('');
  const [hasError, setHasError] = useState(false);
  const [fontInfo, setFontInfo] = useState<any>(null);
  const textRef = useRef<THREE.Mesh>(null);

  // Initialize text and determine font URL with enhanced logging
  useEffect(() => {
    if (!text || typeof text !== 'string') {
      setDisplayText('Node');
      setFontUrl(threejsFontService.getFontUrl('Helvetiker'));
    } else {
      const cleanText = text.trim();
      const limitedText = cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText;
      const finalText = limitedText || 'Node';
      
      setDisplayText(finalText);
      
      // Test Devanagari support and get detailed font info
      const testResult = threejsFontService.testDevanagariSupport(finalText);
      setFontInfo(testResult);
      
      // Get appropriate font URL for the text
      const dynamicFontUrl = threejsFontService.getFontUrlForText(finalText);
      setFontUrl(dynamicFontUrl);
      
      console.log(`[EnhancedText] Enhanced font analysis:`, {
        text: finalText,
        scriptType: testResult.scriptType,
        fontName: testResult.fontName,
        fontUrl: dynamicFontUrl,
        hasDevanagari: testResult.hasDevanagari
      });
    }
    setIsReady(true);
  }, [text]);

  // Load font using useLoader hook with enhanced error handling
  let font;
  try {
    if (fontUrl) {
      font = useLoader(FontLoader, fontUrl, (loader) => {
        console.log(`[EnhancedText] Loading font from: ${fontUrl}`);
      });
      
      if (font && fontInfo?.hasDevanagari) {
        console.log(`[EnhancedText] Successfully loaded Devanagari font for text: "${displayText}"`);
      }
    }
  } catch (error) {
    console.warn('[EnhancedText] Font loading error:', error);
    console.log('[EnhancedText] Font info during error:', fontInfo);
    setHasError(true);
  }

  // Billboard effect
  useFrame(({ camera }) => {
    if (textRef.current && visible && isReady && font) {
      try {
        textRef.current.quaternion.copy(camera.quaternion);
        if (textRef.current.material) {
          (textRef.current.material as any).depthTest = false;
          textRef.current.renderOrder = renderOrder;
        }
      } catch (error) {
        console.warn('[EnhancedText] Billboard error:', error);
      }
    }
  });

  // Handle font loading errors
  const handleError = (error: any) => {
    console.error('[EnhancedText] Render error:', error);
    console.log('[EnhancedText] Error context:', {
      text: displayText,
      fontUrl,
      fontInfo,
      hasError
    });
    setHasError(true);
  };

  if (!visible || !isReady || !font || hasError) {
    return null;
  }

  console.log(`[EnhancedText] Rendering text: "${displayText}" with font analysis:`, fontInfo);

  return (
    <Text
      ref={textRef}
      position={position}
      color={color}
      fontSize={size}
      anchorX="center"
      anchorY="middle"
      maxWidth={maxWidth}
      textAlign="center"
      font={font}
      fontWeight={bold ? "bold" : "normal"}
      material-transparent={true}
      material-depthTest={false}
      renderOrder={renderOrder}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
      onError={handleError}
    >
      {displayText}
    </Text>
  );
};

export default EnhancedText;
