
import React, { useState, useEffect } from 'react';
import { Text } from '@react-three/drei';
import { useTranslation } from '@/contexts/TranslationContext';
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
  size = 0.45, // Increased from 0.15 to 0.45 (3x larger)
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
    <group>
      <Text
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
        // Using a rotation matrix to make text face the camera instead of billboard prop
        rotation={[0, 0, 0]}
        // Add lookAt functionality in the next frame update
        onAfterRender={(state) => {
          if (state && state.camera) {
            // Get the mesh from the Text component
            const mesh = state.scene.children.find(child => 
              child instanceof THREE.Mesh && 
              child.material && 
              child.parent && 
              child.parent.uuid === state.scene.uuid
            );
            
            if (mesh) {
              // Make the text always face the camera
              mesh.lookAt(state.camera.position);
            }
          }
        }}
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
