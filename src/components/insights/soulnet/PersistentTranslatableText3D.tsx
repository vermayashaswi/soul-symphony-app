
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
  // IMPROVED: Use provided translation directly for persistent display
  translatedText?: string;
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
  translatedText
}) => {
  // IMPROVED: Use provided translation or fallback to original text
  const displayText = translatedText || text;

  console.log(`[PersistentTranslatableText3D] IMPROVED: Rendering text: "${text}" -> "${displayText}"`);

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
