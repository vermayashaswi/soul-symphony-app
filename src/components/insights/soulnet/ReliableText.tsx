
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { localFontService } from '@/services/localFontService';
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
  const mounted = useRef(true);

  // Initialize with clean text and script detection
  useEffect(() => {
    if (!mounted.current) return;

    if (!text || typeof text !== 'string') {
      setDisplayText('Node');
    } else {
      const cleanText = text.trim();
      const limitedText = cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText;
      const finalText = limitedText || 'Node';
      
      setDisplayText(finalText);
      
      // Determine if we need enhanced font loading
      const scriptType = localFontService.detectScriptType(finalText);
      const needsEnhanced = scriptType !== 'latin';
      setUseEnhanced(needsEnhanced);
      
      console.log(`[ReliableText] Text: "${finalText}", Script: ${scriptType}, Enhanced: ${needsEnhanced}`);
    }
    setIsReady(true);
  }, [text]);

  // Billboard effect for fallback text
  useFrame(({ camera }) => {
    if (textRef.current && visible && isReady && !useEnhanced && mounted.current) {
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
    if (mounted.current) {
      setHasError(true);
      setUseEnhanced(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  if (!visible || !isReady || !displayText || !mounted.current) {
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

  // Fallback to basic text for Latin scripts
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
      font="Inter, system-ui, sans-serif"
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

export default ReliableText;
