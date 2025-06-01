
import React, { useState, useEffect, useRef } from 'react';
import { Text } from '@react-three/drei';
import { useFrame, useLoader } from '@react-three/fiber';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import * as THREE from 'three';
import { consolidatedFontService } from '@/utils/consolidatedFontService';

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
      setFontUrl(consolidatedFontService.getFontUrl('Helvetiker'));
    } else {
      const cleanText = text.trim();
      const limitedText = cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText;
      const finalText = limitedText || 'Node';
      
      setDisplayText(finalText);
      
      // Test Devanagari support and get detailed font info
      const testResult = consolidatedFontService.testDevanagariSupport(finalText);
      setFontInfo(testResult);
      
      // Get appropriate font URL for the text
      const dynamicFontUrl = consolidatedFontService.getFontUrlForText(finalText);
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

  // Enhanced configuration based on script type
  const getTextConfig = () => {
    const scriptType = fontInfo?.scriptType || 'latin';
    
    switch (scriptType) {
      case 'devanagari':
        return {
          maxWidth: 85,
          letterSpacing: 0.18,
          lineHeight: 2.1,
          sdfGlyphSize: 512
        };
      case 'arabic':
        return {
          maxWidth: 75,
          letterSpacing: 0.12,
          lineHeight: 2.0,
          sdfGlyphSize: 512
        };
      case 'chinese':
      case 'japanese':
      case 'korean':
        return {
          maxWidth: 65,
          letterSpacing: 0.06,
          lineHeight: 1.9,
          sdfGlyphSize: 512
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
          sdfGlyphSize: 512
        };
      case 'thai':
        return {
          maxWidth: 70,
          letterSpacing: 0.1,
          lineHeight: 1.95,
          sdfGlyphSize: 512
        };
      default:
        return {
          maxWidth: maxWidth,
          letterSpacing: 0.03,
          lineHeight: 1.5,
          sdfGlyphSize: 256
        };
    }
  };

  const textConfig = getTextConfig();

  console.log(`[EnhancedText] Rendering text: "${displayText}" with font analysis:`, fontInfo);

  return (
    <Text
      ref={textRef}
      position={position}
      color={color}
      fontSize={size}
      anchorX="center"
      anchorY="middle"
      maxWidth={textConfig.maxWidth}
      textAlign="center"
      font={font}
      fontWeight={bold ? "bold" : "normal"}
      material-transparent={true}
      material-depthTest={false}
      renderOrder={renderOrder}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
      letterSpacing={textConfig.letterSpacing}
      lineHeight={textConfig.lineHeight}
      sdfGlyphSize={textConfig.sdfGlyphSize}
      overflowWrap="normal"
      whiteSpace="normal"
      onError={handleError}
    >
      {displayText}
    </Text>
  );
};

export default EnhancedText;
