
import React, { useMemo } from 'react';
import { wrapTextIntelligently, calculateVerticalSpacing } from '@/utils/textWrappingUtils';
import SimpleText from './SimpleText';

interface IntelligentTextRendererProps {
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
  maxCharsPerLine?: number;
  maxLines?: number;
}

export const IntelligentTextRenderer: React.FC<IntelligentTextRendererProps> = ({
  text,
  position,
  color = '#ffffff',
  size = 0.4,
  visible = true,
  renderOrder = 10,
  bold = false,
  outlineWidth = 0.02,
  outlineColor = '#000000',
  maxWidth = 25,
  maxCharsPerLine = 18,
  maxLines = 2
}) => {
  // Wrap text intelligently
  const wrappedText = useMemo(() => {
    return wrapTextIntelligently(text, maxCharsPerLine, maxLines);
  }, [text, maxCharsPerLine, maxLines]);

  // Calculate vertical positioning for multi-line text
  const linePositions = useMemo(() => {
    const { lines } = wrappedText;
    if (lines.length <= 1) {
      return [position];
    }

    const verticalSpacing = calculateVerticalSpacing(lines.length, size);
    const startY = position[1] + (verticalSpacing / 2);

    return lines.map((_, index) => [
      position[0],
      startY - (index * size * 1.2),
      position[2]
    ] as [number, number, number]);
  }, [wrappedText.lines, position, size]);

  console.log(`[IntelligentTextRenderer] Rendering "${text}" as ${wrappedText.lines.length} lines:`, wrappedText.lines);

  if (!visible || wrappedText.lines.length === 0) {
    return null;
  }

  return (
    <>
      {wrappedText.lines.map((line, index) => (
        <SimpleText
          key={`line-${index}`}
          text={line}
          position={linePositions[index]}
          color={color}
          size={size}
          visible={visible}
          renderOrder={renderOrder + index}
          bold={bold}
          outlineWidth={outlineWidth}
          outlineColor={outlineColor}
          maxWidth={maxWidth}
        />
      ))}
    </>
  );
};

export default IntelligentTextRenderer;
