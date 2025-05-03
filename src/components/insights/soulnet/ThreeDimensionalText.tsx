
import React, { useState, useEffect } from 'react';
import { Text } from '@react-three/drei';
import { useTranslation } from '@/contexts/TranslationContext';

interface ThreeDimensionalTextProps {
  text: string;
  position: [number, number, number]; 
  color?: string;
  size?: number;
  bold?: boolean;
  backgroundColor?: string;
  opacity?: number;
  visible?: boolean;
}

export const ThreeDimensionalText: React.FC<ThreeDimensionalTextProps> = ({
  text,
  position,
  color = 'white',
  size = 0.15,
  bold = false,
  backgroundColor,
  opacity = 1,
  visible = true,
}) => {
  const { translate, currentLanguage } = useTranslation();
  const [translatedText, setTranslatedText] = useState(text);
  
  useEffect(() => {
    const translateText = async () => {
      if (currentLanguage !== 'en' && text) {
        try {
          const result = await translate(text);
          if (result) setTranslatedText(result);
        } catch (e) {
          console.error('Translation error:', e);
        }
      } else {
        setTranslatedText(text);
      }
    };
    
    translateText();
  }, [text, currentLanguage, translate]);

  if (!visible || !text) return null;

  return (
    <Text
      position={position}
      color={color}
      fontSize={size}
      fontWeight={bold ? 700 : 400}
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.0035}
      outlineColor="#000000"
      opacity={opacity}
      maxWidth={2}
      overflowWrap="break-word"
      textAlign="center"
    >
      {translatedText}
      {backgroundColor && (
        <meshBasicMaterial
          color={backgroundColor}
          transparent={true}
          opacity={0.7}
          attach="material"
        />
      )}
    </Text>
  );
};

export default ThreeDimensionalText;
