
import React from 'react';
import SmartTextRenderer from './SmartTextRenderer';

interface PersistentTranslatableText3DProps {
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
  maxCharsPerLine?: number;
  maxLines?: number;
  // CACHE-FIRST: Direct translation with immediate fallback
  translation?: string;
  useTranslation?: boolean;
  cacheFirst?: boolean;
}

export const PersistentTranslatableText3D: React.FC<PersistentTranslatableText3DProps> = ({
  text,
  position,
  color = '#000000',
  size = 0.4,
  visible = true,
  renderOrder = 10,
  bold = false,
  outlineWidth = 0,
  outlineColor,
  maxWidth = 25,
  enableWrapping = false,
  maxCharsPerLine = 18,
  maxLines = 3,
  translation,
  useTranslation = false,
  cacheFirst = true
}) => {
  // CACHE-FIRST: Prioritize translation if available, fallback to original
  const displayText = React.useMemo(() => {
    if (useTranslation && translation && cacheFirst) {
      return translation;
    }
    return text;
  }, [text, translation, useTranslation, cacheFirst]);

  console.log(`[PersistentTranslatableText3D] CACHE-FIRST: Rendering "${text}" -> "${displayText}" (useTranslation: ${useTranslation}, cacheFirst: ${cacheFirst})`);

  return (
    <SmartTextRenderer
      text={displayText}
      position={position}
      color={color}
      size={size}
      visible={visible}
      renderOrder={renderOrder}
      bold={bold}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
      maxWidth={maxWidth}
      enableWrapping={enableWrapping}
      maxCharsPerLine={maxCharsPerLine}
      maxLines={maxLines}
    />
  );
};

export default PersistentTranslatableText3D;
