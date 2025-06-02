import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { fontService } from '@/utils/fontService';
import EnhancedText from './EnhancedText';
import { useSafeTranslation } from './ContextSafetyWrapper';

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
  const [fontConfig, setFontConfig] = useState<any>(null);
  const textRef = useRef<THREE.Mesh>(null);
  const mounted = useRef(true);

  // Use safe translation context
  const { currentLanguage, translate, isTranslationReady, isFontReady } = useSafeTranslation();

  console.log('[ReliableText] Using safe context:', {
    currentLanguage,
    hasTranslate: !!translate,
    isTranslationReady,
    isFontReady
  });

  // Initialize with enhanced font analysis
  useEffect(() => {
    if (!mounted.current || !isFontReady) return;

    const initializeText = async () => {
      if (!text || typeof text !== 'string') {
        setDisplayText('Node');
        setIsReady(true);
        return;
      }

      const cleanText = text.trim();
      const limitedText = cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText;
      let finalText = limitedText || 'Node';
      
      // Handle translation if available
      if (currentLanguage !== 'en' && translate && isTranslationReady) {
        try {
          const translated = await translate(finalText);
          if (translated && typeof translated === 'string') {
            finalText = translated;
            console.log('[ReliableText] Translation successful:', finalText);
          }
        } catch (error) {
          console.warn('[ReliableText] Translation failed:', error);
        }
      }
      
      setDisplayText(finalText);
      
      try {
        // Get enhanced font configuration
        const config = fontService.getBestFontConfig(finalText);
        setFontConfig(config);
        
        // Determine if we need enhanced font loading
        const needsEnhanced = config.scriptType !== 'latin' || config.needsValidation;
        setUseEnhanced(needsEnhanced);
        
        console.log(`[ReliableText] Enhanced text analysis:`, {
          text: finalText,
          scriptType: config.scriptType,
          fontName: config.fontName,
          needsEnhanced,
          cssFamily: config.cssFamily
        });

        // Preload fonts for the detected script
        if (needsEnhanced) {
          await fontService.preloadFontsForScript(config.scriptType);
        }
      } catch (error) {
        console.warn('[ReliableText] Font analysis failed, using defaults:', error);
        setFontConfig({
          scriptType: 'latin',
          fontName: 'Helvetiker',
          cssFamily: 'Inter, system-ui, sans-serif',
          needsValidation: false
        });
      }
      
      setIsReady(true);
    };

    initializeText();
  }, [text, currentLanguage, translate, isTranslationReady, isFontReady]);

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

  // Use enhanced text for non-Latin scripts or if validation is needed
  if (useEnhanced && !hasError && fontConfig) {
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

  // Fallback to basic text with enhanced CSS font family
  const cssFamily = fontConfig?.cssFamily || 'Inter, system-ui, sans-serif';
  
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
      font={cssFamily}
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
