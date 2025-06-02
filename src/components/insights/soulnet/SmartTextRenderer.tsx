
import React from 'react';
import SimplifiedTextRenderer from './SimplifiedTextRenderer';

interface SmartTextRendererProps {
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
}

export const SmartTextRenderer: React.FC<SmartTextRendererProps> = ({
  text,
  position,
  color = '#ffffff',
  size = 0.4,
  visible = true,
  renderOrder = 10,
  bold = false,
  outlineWidth = 0.02,
  outlineColor = '#000000',
  maxWidth = 25
}) => {
  console.log(`[SmartTextRenderer] Simplified mode - rendering: "${text}" with Three.js Text only`);

  // Always use SimplifiedTextRenderer for consistency and reliability
  return (
    <SimplifiedTextRenderer
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
    />
  );
};

export default SmartTextRenderer;
