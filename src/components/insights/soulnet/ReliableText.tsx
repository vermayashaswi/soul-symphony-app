
import React from 'react';
import TranslatableText3D from './TranslatableText3D';

interface ReliableTextProps {
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
}

export const ReliableText: React.FC<ReliableTextProps> = ({
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
  enableWrapping = false
}) => {
  console.log(`[Re-implemented ReliableText] Using Google Web Translate for: "${text}"`);

  if (!visible) {
    return null;
  }

  return (
    <TranslatableText3D
      text={text}
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
      sourceLanguage="en"
    />
  );
};

export default ReliableText;
