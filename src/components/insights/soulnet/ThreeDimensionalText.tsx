import React, { useState, useEffect, useRef } from 'react';
import { Text } from '@react-three/drei';
import { useTranslation } from '@/contexts/TranslationContext';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

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
  size = 1.7, // Increased from 1.2 to 1.7 for better visibility
  bold = false,
  backgroundColor,
  opacity = 1,
  visible = true,
}) => {
  const { translate, currentLanguage } = useTranslation();
  const [translatedText, setTranslatedText] = useState(text);
  const { camera } = useThree();
  const textRef = useRef<THREE.Mesh>(null);
  
  // Update the text mesh to face the camera on each frame
  useFrame(() => {
    if (textRef.current && camera) {
      textRef.current.lookAt(camera.position);
    }
  });
  
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
    <group>
      <Text
        ref={textRef}
        position={position}
        color={color}
        fontSize={size}
        fontWeight={bold ? 700 : 400}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.0035}
        outlineColor="#000000"
        maxWidth={2}
        overflowWrap="break-word"
        textAlign="center"
        // Use a rotation that will be updated by useFrame
        rotation={[0, 0, 0]}
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
        <meshBasicMaterial 
          color={color}
          transparent={true}
          opacity={opacity}
          toneMapped={false}
        />
      </Text>
    </group>
  );
};

export default ThreeDimensionalText;
