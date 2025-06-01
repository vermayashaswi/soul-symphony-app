
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { consolidatedFontService } from '@/utils/consolidatedFontService';
import EnhancedText from './EnhancedText';

interface ReliableTextProps {
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

export const ReliableText: React.FC<ReliableTextProps> = ({
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
  const [useEnhanced, setUseEnhanced] = useState(false);
  const [hasError, setHasError] = useState(false);
  const textRef = useRef<THREE.Mesh>(null);

  // Initialize with clean text and script detection
  useEffect(() => {
    if (!text || typeof text !== 'string') {
      setDisplayText('Node');
    } else {
      const cleanText = text.trim();
      const limitedText = cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText;
      const finalText = limitedText || 'Node';
      
      setDisplayText(finalText);
      
      // Determine if we need enhanced font loading
      const scriptType = consolidatedFontService.detectScriptType(finalText);
      const needsEnhanced = scriptType !== 'latin';
      setUseEnhanced(needsEnhanced);
      
      console.log(`[ReliableText] Text: "${finalText}", Script: ${scriptType}, Enhanced: ${needsEnhanced}`);
    }
    setIsReady(true);
  }, [text]);

  // Billboard effect for fallback text
  useFrame(({ camera }) => {
    if (textRef.current && visible && isReady && !useEnhanced) {
      try {
        textRef.current.quaternion.copy(camera.quaternion);
        if (textRef.current.material) {
          (textRef.current.material as any).depthTest = false;
          textRef.current.renderOrder = renderOrder;
        }
      } catch (error) {
        console.warn('[ReliableText] Billboard error:', error);
      }
    }
  });

  const handleError = (error: any) => {
    console.error('[ReliableText] Render error, falling back:', error);
    setHasError(true);
    setUseEnhanced(false);
  };

  if (!visible || !isReady || !displayText) {
    return null;
  }

  // Use enhanced text for non-Latin scripts or if specifically needed
  if (useEnhanced && !hasError) {
    return (
      <Suspense fallback={null}>
        <EnhancedText
          text={displayText}
          position={position}
          color={color}
          size={size}
          visible={true}
          renderOrder={renderOrder}
          bold={bold}
          outlineWidth={outlineWidth}
          outlineColor={outlineColor}
          maxWidth={maxWidth}
        />
      </Suspense>
    );
  }

  // Fallback to basic text for Latin scripts with optimized configuration
  const getTextConfig = () => {
    const scriptType = consolidatedFontService.detectScriptType(displayText);
    
    switch (scriptType) {
      case 'devanagari':
        return {
          maxWidth: 85,
          letterSpacing: 0.18,
          lineHeight: 2.1,
          fontFamily: 'Noto Sans Devanagari, system-ui, sans-serif'
        };
      case 'arabic':
        return {
          maxWidth: 75,
          letterSpacing: 0.12,
          lineHeight: 2.0,
          fontFamily: 'Noto Sans Arabic, system-ui, sans-serif'
        };
      default:
        return {
          maxWidth: maxWidth,
          letterSpacing: 0.03,
          lineHeight: 1.5,
          fontFamily: 'Inter, system-ui, sans-serif'
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
      font={textConfig.fontFamily}
      fontWeight={bold ? "bold" : "normal"}
      material-transparent={true}
      material-depthTest={false}
      renderOrder={renderOrder}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
      letterSpacing={textConfig.letterSpacing}
      lineHeight={textConfig.lineHeight}
      onError={handleError}
    >
      {displayText}
    </Text>
  );
};

export default ReliableText;
