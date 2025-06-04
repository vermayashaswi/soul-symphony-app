
import React, { useState, useEffect, useMemo } from 'react';
import { Text } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { universalFontService } from '@/services/universalFontService';
import { useTranslation } from '@/contexts/TranslationContext';

interface TranslatableText3DProps {
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
  enableWrapping?: boolean;
  sourceLanguage?: string;
}

export const TranslatableText3D: React.FC<TranslatableText3DProps> = ({
  text,
  position,
  color = '#ffffff',
  size = 0.4,
  visible = true,
  renderOrder = 10,
  bold = false,
  outlineWidth = 0.02,
  outlineColor = '#333333',
  maxWidth = 25,
  enableWrapping = false,
  sourceLanguage = 'en'
}) => {
  const { currentLanguage, translate } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isTranslating, setIsTranslating] = useState(false);

  console.log(`[TranslatableText3D] Rendering text: "${text}" (${currentLanguage})`);

  // Handle translation using Google Web Translate
  useEffect(() => {
    let isMounted = true;

    const translateText = async () => {
      if (!text || currentLanguage === sourceLanguage) {
        setTranslatedText(text);
        return;
      }

      console.log(`[TranslatableText3D] Translating "${text}" from ${sourceLanguage} to ${currentLanguage}`);
      
      try {
        setIsTranslating(true);
        const result = await translate(text, sourceLanguage);
        
        if (isMounted && result) {
          console.log(`[TranslatableText3D] Translation successful: "${text}" -> "${result}"`);
          setTranslatedText(result);
        } else if (isMounted) {
          console.log(`[TranslatableText3D] No translation result, using original text`);
          setTranslatedText(text);
        }
      } catch (error) {
        console.error(`[TranslatableText3D] Translation failed for "${text}":`, error);
        if (isMounted) {
          setTranslatedText(text);
        }
      } finally {
        if (isMounted) {
          setIsTranslating(false);
        }
      }
    };

    translateText();

    return () => {
      isMounted = false;
    };
  }, [text, currentLanguage, sourceLanguage, translate]);

  // Get font URL based on translated text and current language
  const fontUrl = universalFontService.getFontUrl(translatedText, currentLanguage);
  
  // Load font using React Three Fiber's useLoader with error handling
  let font;
  try {
    font = useLoader(FontLoader, fontUrl);
  } catch (error) {
    console.warn(`[TranslatableText3D] Failed to load font for ${currentLanguage}, falling back to Latin`, error);
    font = useLoader(FontLoader, universalFontService.getFontUrl('fallback', 'en'));
  }

  // Enhanced outline logic for better readability
  const shouldUseOutline = useMemo(() => {
    return color !== '#000000' || universalFontService.isComplexScript(translatedText);
  }, [color, translatedText]);

  const effectiveOutlineWidth = shouldUseOutline ? outlineWidth : 0;
  const effectiveOutlineColor = shouldUseOutline ? (color === '#ffffff' ? '#000000' : outlineColor) : undefined;

  if (!visible || !font) {
    return null;
  }

  console.log(`[TranslatableText3D] Final render: "${translatedText}" (translating: ${isTranslating})`);

  return (
    <Text
      position={position}
      color={color}
      fontSize={size}
      anchorX="center"
      anchorY="middle"
      maxWidth={enableWrapping ? maxWidth : undefined}
      textAlign="center"
      font={font}
      fontWeight={bold ? "bold" : "normal"}
      material-transparent={true}
      material-depthTest={false}
      renderOrder={renderOrder}
      outlineWidth={effectiveOutlineWidth}
      outlineColor={effectiveOutlineColor}
    >
      {translatedText}
    </Text>
  );
};

export default TranslatableText3D;
