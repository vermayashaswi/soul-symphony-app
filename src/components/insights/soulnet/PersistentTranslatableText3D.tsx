
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
  // SIMPLIFIED: Use provided translation or original text
  translation?: string;
  useTranslation?: boolean;
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
  useTranslation = false
}) => {
  // SIMPLIFIED: Use translation if provided and useTranslation is true, otherwise use original text
  const displayText = (useTranslation && translation) ? translation : text;

  console.log(`[PersistentTranslatableText3D] SIMPLIFIED: Rendering "${text}" -> "${displayText}" (useTranslation: ${useTranslation})`);

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
