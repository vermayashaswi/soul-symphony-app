
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
  // Skip rendering if no text provided
  if (!text) return null;
  
  console.log(`Rendering TranslatableNodeText: "${text}"`);

  // Use a fixed z-index instead of template literals to avoid rendering issues
  const zIndexClass = `z-[9999]`;

  return (
    <Html
      position={htmlPosition}
      center={center}
      distanceFactor={distanceFactor}
      occlude={occlude}
      className={`${zIndexClass} ${className}`}
    >
      <TranslatableText
        text={text}
        forceTranslate={forceTranslate}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          // Add better visibility attributes
          textShadow: '0 0 4px rgba(0,0,0,0.8)',
          ...style
        }}
      />
    </Html>
  );
};

export default TranslatableNodeText;
