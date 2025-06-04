
import React, { useState, useEffect } from 'react';
import { universalFontService } from '@/services/universalFontService';
import CanvasTextRenderer from './CanvasTextRenderer';
import TranslatableText3D from './TranslatableText3D';
import { wrapTextIntelligently, calculateOptimalMaxWidth } from '@/utils/textWrappingUtils';
import { useTranslation } from '@/contexts/TranslationContext';

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
  const { currentLanguage } = useTranslation();
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

        const isComplex = universalFontService.isComplexScript(finalText);
        const isMultiLine = finalText.includes('\n');
        
        // Enhanced renderer selection logic
        // Use Canvas for very complex scripts or when Three.js fonts might not be available
        const preferCanvas = isComplex && ['ar', 'zh', 'ja', 'ko'].includes(currentLanguage);
        
        if (preferCanvas) {
          console.log(`[SmartTextRenderer] Using Canvas renderer for complex script: "${finalText}" (${currentLanguage})`);
          setUseCanvasRenderer(true);
          setFontLoaded(true);
        } else {
          console.log(`[SmartTextRenderer] Using TranslatableText3D renderer for: "${finalText}" (${currentLanguage}, multiline: ${isMultiLine}, size: ${size})`);
          try {
            await universalFontService.loadFont(finalText, currentLanguage);
            setUseCanvasRenderer(false);
            setFontLoaded(true);
            console.log(`[SmartTextRenderer] Three.js font loaded successfully for: "${finalText}" (${currentLanguage})`);
          } catch (error) {
            console.warn(`[SmartTextRenderer] Three.js font loading failed for: "${finalText}" (${currentLanguage}), falling back to Canvas`, error);
            setUseCanvasRenderer(true);
            setFontLoaded(true);
          }
        }
      } catch (error) {
        console.error(`[SmartTextRenderer] Error initializing renderer for: "${text}" (${currentLanguage})`, error);
        setHasError(true);
      }
    };

    initializeRenderer();
  }, [text, size, enableWrapping, maxCharsPerLine, maxLines, maxWidth, currentLanguage]);

  if (!visible || hasError || !fontLoaded) {
    return null;
  }

  console.log(`[SmartTextRenderer] Using ${useCanvasRenderer ? 'Canvas' : 'TranslatableText3D'} renderer for text: "${processedText}" (${currentLanguage}) with size: ${size}, color: ${color}`);

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
    <TranslatableText3D
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
      sourceLanguage="en"
    />
  );
};

export default SmartTextRenderer;
