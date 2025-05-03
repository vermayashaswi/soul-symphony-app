
import React from 'react';
import { Html } from '@react-three/drei';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface TranslatableNodeTextProps {
  text: string;
  style?: React.CSSProperties;
  className?: string;
  htmlPosition?: [number, number, number];
  center?: boolean;
  distanceFactor?: number;
  occlude?: boolean;
  zIndexRange?: [number, number];
  forceTranslate?: boolean;
}

export const TranslatableNodeText: React.FC<TranslatableNodeTextProps> = ({
  text,
  style = {},
  className = "",
  htmlPosition = [0, 0, 0],
  center = true,
  distanceFactor = 15,
  occlude = false,
  zIndexRange = [9997, 9999],
  forceTranslate = true
}) => {
  console.log(`TranslatableNodeText rendering: "${text}"`);
  
  if (!text) return null;

  return (
    <Html
      position={htmlPosition}
      center={center}
      distanceFactor={distanceFactor}
      occlude={occlude}
      className={`z-50 ${className}`}
    >
      <TranslatableText
        text={text}
        forceTranslate={forceTranslate}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          ...style
        }}
      />
    </Html>
  );
};

export default TranslatableNodeText;
