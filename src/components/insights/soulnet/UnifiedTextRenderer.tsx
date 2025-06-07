
import React, { useState, useEffect, useMemo } from 'react';
import { enhancedFontService } from '@/services/enhancedFontService';
import CanvasTextRenderer from './CanvasTextRenderer';
import SimpleText from './SimpleText';
import { wrapTextIntelligently, calculateOptimalMaxWidth } from '@/utils/textWrappingUtils';

interface UnifiedTextRendererProps {
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

export const UnifiedTextRenderer: React.FC<UnifiedTextRendererProps> = ({
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
  const [useCanvasRenderer, setUseCanvasRenderer] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [processedText, setProcessedText] = useState('');
  const [optimalMaxWidth, setOptimalMaxWidth] = useState(maxWidth);

  // Text validation
  const isValidText = useMemo(() => {
    return typeof text === 'string' && text.trim().length > 0;
  }, [text]);

  useEffect(() => {
    const initializeRenderer = async () => {
      try {
        if (!isValidText) {
          console.warn(`[UnifiedTextRenderer] Invalid text: "${text}"`);
          setHasError(true);
          return;
        }

        // Process text wrapping
        let finalText = text;
        let calculatedMaxWidth = maxWidth;

        if (enableWrapping) {
          const wrappedResult = wrapTextIntelligently(text, maxCharsPerLine, maxLines);
          finalText = wrappedResult.lines.join('\n');
          calculatedMaxWidth = calculateOptimalMaxWidth(wrappedResult, size);
        }

        setProcessedText(finalText);
        setOptimalMaxWidth(calculatedMaxWidth);

        const isComplex = enhancedFontService.isComplexScript(finalText);
        
        if (isComplex) {
          console.log(`[UnifiedTextRenderer] Using Canvas renderer for complex script: "${finalText}"`);
          setUseCanvasRenderer(true);
          setFontLoaded(true);
        } else {
          console.log(`[UnifiedTextRenderer] Using Three.js renderer for: "${finalText}"`);
          try {
            await enhancedFontService.loadFont(finalText);
            setUseCanvasRenderer(false);
            setFontLoaded(true);
            console.log(`[UnifiedTextRenderer] Three.js font loaded successfully for: "${finalText}"`);
          } catch (error) {
            console.warn(`[UnifiedTextRenderer] Three.js font loading failed, using Canvas:`, error);
            setUseCanvasRenderer(true);
            setFontLoaded(true);
          }
        }
      } catch (error) {
        console.error(`[UnifiedTextRenderer] Error initializing renderer:`, error);
        setHasError(true);
      }
    };

    initializeRenderer();
  }, [text, size, enableWrapping, maxCharsPerLine, maxLines, maxWidth, isValidText]);

  if (!visible || hasError || !fontLoaded || !isValidText) {
    return null;
  }

  console.log(`[UnifiedTextRenderer] Rendering with ${useCanvasRenderer ? 'Canvas' : 'Three.js'}: "${processedText}"`);

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

export default UnifiedTextRenderer;
