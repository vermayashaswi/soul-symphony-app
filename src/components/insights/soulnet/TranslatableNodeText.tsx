import React, { useState, useEffect, useRef } from 'react';
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
}

export const TranslatableNodeText: React.FC<TranslatableNodeTextProps> = ({
  text,
  style = {},
  className = "",
  htmlPosition = [0, 0, 0],
  center = true,
  distanceFactor = 15,
  occlude = false,
  zIndexRange = [9997, 9999]
}) => {
  // Keep track of mount state to prevent memory leaks
  const mountedRef = useRef(true);
  const [isReady, setIsReady] = useState(false);

  // Initialize component and handle unmounting
  useEffect(() => {
    // Small delay to ensure proper render after Three.js initialization
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        setIsReady(true);
      }
    }, 50);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, []);

  if (!text) return null;

  return (
    <Html
      position={htmlPosition}
      center={center}
      distanceFactor={distanceFactor}
      occlude={occlude}
      className={`z-[${zIndexRange[0]}] ${className}`}
    >
      {isReady && (
        <TranslatableText
          text={text}
          forceTranslate={true}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            ...style
          }}
        />
      )}
    </Html>
  );
};

export default TranslatableNodeText;
