
import React, { useState, useEffect } from 'react';
import { enhancedFontService } from '@/services/enhancedFontService';
import CanvasTextRenderer from './CanvasTextRenderer';
import { wrapTextIntelligently, calculateOptimalMaxWidth } from '@/utils/textWrappingUtils';

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
  enableWrapping?: boolean;
  maxCharsPerLine?: number;
  maxLines?: number;
}

export const SmartTextRenderer: React.FC<SmartTextRendererProps> = ({
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
  maxLines = 3
}) => {
  const [isReady, setIsReady] = useState(false);
  const [processedText, setProcessedText] = useState('');
  const [optimalMaxWidth, setOptimalMaxWidth] = useState(maxWidth);

  useEffect(() => {
    const initializeRenderer = async () => {
      try {
        setIsReady(false);

        // Process text wrapping first
        let finalText = text;
        let calculatedMaxWidth = maxWidth;

        if (enableWrapping) {
          const wrappedResult = wrapTextIntelligently(text, maxCharsPerLine, maxLines);
          finalText = wrappedResult.lines.join('\n');
          calculatedMaxWidth = calculateOptimalMaxWidth(wrappedResult, size);
          
          console.log(`[SmartTextRenderer] Text wrapped: "${text}" -> "${finalText}" (${wrappedResult.totalLines} lines, maxWidth: ${calculatedMaxWidth})`);
        }

        setProcessedText(finalText);
        setOptimalMaxWidth(calculatedMaxWidth);

        // Always use Canvas renderer as primary
        console.log(`[SmartTextRenderer] Using Canvas renderer (primary) for: "${finalText}"`);
        setIsReady(true);
      } catch (error) {
        console.error(`[SmartTextRenderer] Error during initialization:`, error);
        // Still use Canvas renderer on any error
        setProcessedText(text || 'Node');
        setIsReady(true);
      }
    };

    initializeRenderer();
  }, [text, size, enableWrapping, maxCharsPerLine, maxLines, maxWidth]);

  // Don't render anything if not visible or not ready
  if (!visible || !isReady) {
    return null;
  }

  // Always show something, even if there was an error
  const safeText = processedText || text || 'Node';

  console.log(`[SmartTextRenderer] Rendering with Canvas (primary): "${safeText}"`);

  // Always use Canvas renderer
  return (
    <CanvasTextRenderer
      text={safeText}
      position={position}
      color={color}
      size={size}
      visible={visible}
      renderOrder={renderOrder}
      bold={bold}
      maxWidth={optimalMaxWidth}
      enableWrapping={enableWrapping}
    />
  );
};

export default SmartTextRenderer;
