
import React, { useState, useEffect, useRef } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { localFontService } from '@/services/localFontService';
import SafeFontLoader from './SafeFontLoader';

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
  const [fallbackUrl, setFallbackUrl] = useState('');
  const [fontInfo, setFontInfo] = useState<any>(null);
  const textRef = useRef<THREE.Mesh>(null);
  const mounted = useRef(true);

  // Initialize text and determine font URLs
  useEffect(() => {
    if (!mounted.current) return;

    if (!text || typeof text !== 'string') {
      setDisplayText('Node');
      setFontUrl(localFontService.getFontUrl('Helvetiker'));
      setFallbackUrl(localFontService.getFallbackUrl('Helvetiker'));
    } else {
      const cleanText = text.trim();
      const limitedText = cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText;
      const finalText = limitedText || 'Node';
      
      setDisplayText(finalText);
      
      // Test Devanagari support and get font info
      const testResult = localFontService.testDevanagariSupport(finalText);
      setFontInfo(testResult);
      
      // Get local and fallback font URLs
      const localUrl = localFontService.getFontUrlForText(finalText, true);
      const fallbackUrl = localFontService.getFallbackUrl(testResult.fontName);
      
      setFontUrl(localUrl);
      setFallbackUrl(fallbackUrl);
      
      console.log(`[EnhancedText] Font configuration:`, {
        text: finalText,
        scriptType: testResult.scriptType,
        fontName: testResult.fontName,
        localUrl,
        fallbackUrl,
        hasDevanagari: testResult.hasDevanagari
      });
    }
    setIsReady(true);
  }, [text]);

  // Billboard effect
  useFrame(({ camera }) => {
    if (textRef.current && visible && isReady && mounted.current) {
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  if (!visible || !isReady || !mounted.current) {
    return null;
  }

  console.log(`[EnhancedText] Rendering with SafeFontLoader: "${displayText}"`);

  return (
    <SafeFontLoader
      fontUrl={fontUrl}
      fallbackFont={fallbackUrl}
      retryCount={2}
      textToValidate={displayText} // Pass text for validation
    >
      {(font, isLoading, hasError) => {
        if (isLoading || !font) {
          return null;
        }

        if (hasError) {
          console.warn(`[EnhancedText] Font loading failed for "${displayText}", skipping render`);
          return null;
        }

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
          >
            {displayText}
          </Text>
        );
      }}
    </SafeFontLoader>
  );
};

export default EnhancedText;
