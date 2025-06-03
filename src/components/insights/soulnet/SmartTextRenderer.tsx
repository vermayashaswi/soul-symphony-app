
import React, { useState, useEffect } from 'react';
import { enhancedFontService } from '@/services/enhancedFontService';
import CanvasTextRenderer from './CanvasTextRenderer';
import SimpleText from './SimpleText';
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
  outlineWidth = 0.02,
  outlineColor = '#f5f5f5',
  maxWidth = 25,
  enableWrapping = false,
  maxCharsPerLine = 18,
  maxLines = 3
}) => {
  const [useCanvasRenderer, setUseCanvasRenderer] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [processedText, setProcessedText] = useState('');
  const [optimalMaxWidth, setOptimalMaxWidth] = useState(maxWidth);

  useEffect(() => {
    const initializeRenderer = async () => {
      try {
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

        const isComplex = enhancedFontService.isComplexScript(finalText);
        const isMultiLine = finalText.includes('\n');
        
        // UPDATED: More selective Canvas renderer usage to maintain font size consistency
        // Only use Canvas for complex scripts OR very large text (> 8.0)
        // This allows Three.js Text to handle multi-line text with consistent sizing
        const preferCanvas = isComplex || size > 8.0;
        
        if (preferCanvas) {
          console.log(`[SmartTextRenderer] FONT SIZE CONSISTENCY: Using Canvas renderer for: "${finalText}" (complex: ${isComplex}, very large text: ${size > 8.0})`);
          setUseCanvasRenderer(true);
          setFontLoaded(true);
        } else {
          console.log(`[SmartTextRenderer] FONT SIZE CONSISTENCY: Using Three.js renderer for: "${finalText}" (multiline: ${isMultiLine}, size: ${size}) - CONSISTENT SIZING`);
          try {
            await enhancedFontService.loadFont(finalText);
            setUseCanvasRenderer(false);
            setFontLoaded(true);
            console.log(`[SmartTextRenderer] Three.js font loaded successfully for: "${finalText}" with consistent sizing`);
          } catch (error) {
            console.warn(`[SmartTextRenderer] Three.js font loading failed for: "${finalText}", falling back to Canvas`, error);
            setUseCanvasRenderer(true);
            setFontLoaded(true);
          }
        }
      } catch (error) {
        console.error(`[SmartTextRenderer] Error initializing renderer for: "${text}"`, error);
        setHasError(true);
      }
    };

    initializeRenderer();
  }, [text, size, enableWrapping, maxCharsPerLine, maxLines, maxWidth]);

  if (!visible || hasError || !fontLoaded) {
    return null;
  }

  console.log(`[SmartTextRenderer] RENDERER SELECTION: Using ${useCanvasRenderer ? 'Canvas' : 'Three.js'} renderer for text: "${processedText}" with size: ${size}`);

  if (useCanvasRenderer) {
    return (
      <CanvasTextRenderer
        text={processedText}
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
  }

  return (
    <SimpleText
      text={processedText}
      position={position}
      color={color}
      size={size}
      visible={visible}
      renderOrder={renderOrder}
      bold={bold}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
      maxWidth={optimalMaxWidth}
      enableWrapping={enableWrapping}
    />
  );
};

export default SmartTextRenderer;
