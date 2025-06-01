
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { consolidatedFontService } from '@/utils/consolidatedFontService';

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
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const textRef = useRef<THREE.Mesh>(null);
  const mountedRef = useRef(true);

  // Initialize with clean text and enhanced error handling
  useEffect(() => {
    if (!text || typeof text !== 'string') {
      setDisplayText('Node');
    } else {
      const cleanText = text.trim();
      const limitedText = cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText;
      const finalText = limitedText || 'Node';
      
      setDisplayText(finalText);
      
      console.log(`[ReliableText] Processing text: "${finalText}"`);
    }
    setIsReady(true);
  }, [text]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Billboard effect with enhanced stability
  useFrame(({ camera }) => {
    if (textRef.current && visible && isReady && !hasError) {
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
    console.error('[ReliableText] Render error:', error);
    setHasError(true);
    
    // Implement retry logic for transient errors
    if (retryCount < 3) {
      setTimeout(() => {
        if (mountedRef.current) {
          setHasError(false);
          setRetryCount(prev => prev + 1);
          console.log(`[ReliableText] Retrying render, attempt ${retryCount + 1}`);
        }
      }, 1000);
    }
  };

  if (!visible || !isReady || !displayText || hasError) {
    return null;
  }

  // Enhanced text configuration based on script detection
  const getTextConfig = () => {
    const scriptType = consolidatedFontService.detectScriptType(displayText);
    const fontFamily = consolidatedFontService.getOptimalFontFamily(scriptType);
    
    switch (scriptType) {
      case 'devanagari':
        return {
          maxWidth: 30,
          letterSpacing: 0.15,
          lineHeight: 1.8,
          fontFamily
        };
      case 'arabic':
        return {
          maxWidth: 28,
          letterSpacing: 0.12,
          lineHeight: 1.7,
          fontFamily
        };
      default:
        return {
          maxWidth: maxWidth,
          letterSpacing: 0.03,
          lineHeight: 1.4,
          fontFamily
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
