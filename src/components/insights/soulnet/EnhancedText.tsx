
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
  const [retryCount, setRetryCount] = useState(0);
  const textRef = useRef<THREE.Mesh>(null);
  const mountedRef = useRef(true);

  // Initialize text and determine font URL
  useEffect(() => {
    if (!text || typeof text !== 'string') {
      setDisplayText('Node');
      setFontUrl('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json');
    } else {
      const cleanText = text.trim();
      const limitedText = cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText;
      const finalText = limitedText || 'Node';
      
      setDisplayText(finalText);
      
      // Get appropriate font URL for the text
      const dynamicFontUrl = consolidatedFontService.getFontUrlForText(finalText);
      setFontUrl(dynamicFontUrl);
      
      console.log(`[EnhancedText] Text: "${finalText}", Font URL: ${dynamicFontUrl}`);
    }
    setIsReady(true);
  }, [text]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load font with enhanced error handling
  let font;
  try {
    if (fontUrl && !hasError) {
      font = useLoader(FontLoader, fontUrl, (loader) => {
        console.log(`[EnhancedText] Loading font from: ${fontUrl}`);
      });
    }
  } catch (error) {
    console.warn('[EnhancedText] Font loading error:', error);
    if (!hasError && retryCount < 2) {
      setTimeout(() => {
        if (mountedRef.current) {
          setRetryCount(prev => prev + 1);
          console.log(`[EnhancedText] Retrying font load, attempt ${retryCount + 1}`);
        }
      }, 1000);
    } else {
      setHasError(true);
    }
  }

  // Billboard effect
  useFrame(({ camera }) => {
    if (textRef.current && visible && isReady && font && !hasError) {
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

  const handleError = (error: any) => {
    console.error('[EnhancedText] Render error:', error);
    setHasError(true);
  };

  if (!visible || !isReady || !font || hasError) {
    return null;
  }

  // Enhanced configuration based on script type
  const getTextConfig = () => {
    const scriptType = consolidatedFontService.detectScriptType(displayText);
    
    switch (scriptType) {
      case 'devanagari':
        return {
          maxWidth: 30,
          letterSpacing: 0.15,
          lineHeight: 1.8,
          sdfGlyphSize: 256
        };
      case 'arabic':
        return {
          maxWidth: 28,
          letterSpacing: 0.12,
          lineHeight: 1.7,
          sdfGlyphSize: 256
        };
      default:
        return {
          maxWidth: maxWidth,
          letterSpacing: 0.03,
          lineHeight: 1.4,
          sdfGlyphSize: 256
        };
    }
  };

  const textConfig = getTextConfig();

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
      onError={handleError}
    >
      {displayText}
    </Text>
  );
};

export default EnhancedText;
