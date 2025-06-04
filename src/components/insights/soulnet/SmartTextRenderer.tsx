
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
  outlineWidth = 0,
  outlineColor,
  maxWidth = 25,
  enableWrapping = false,
  maxCharsPerLine = 18,
  maxLines = 3
}) => {
  const [useCanvasRenderer, setUseCanvasRenderer] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [processedText, setProcessedText] = useState('');
  const [optimalMaxWidth, setOptimalMaxWidth] = useState(maxWidth);

  useEffect(() => {
    const initializeRenderer = async () => {
      try {
        setHasError(false);
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

        const isComplex = enhancedFontService.isComplexScript(finalText);
        const canLoadFonts = enhancedFontService.canLoadFonts();
        
        // Always prefer Canvas for complex scripts or if THREE.js font loading is not available
        if (isComplex || !canLoadFonts) {
          console.log(`[SmartTextRenderer] Using Canvas renderer - Complex: ${isComplex}, CanLoadFonts: ${canLoadFonts}`);
          setUseCanvasRenderer(true);
          setIsReady(true);
          return;
        }

        // Try Three.js renderer for simple scripts
        console.log(`[SmartTextRenderer] Attempting Three.js renderer for: "${finalText}"`);
        try {
          await enhancedFontService.loadFont(finalText);
          console.log(`[SmartTextRenderer] Three.js font loaded successfully for: "${finalText}"`);
          setUseCanvasRenderer(false);
          setIsReady(true);
        } catch (fontError) {
          console.warn(`[SmartTextRenderer] Three.js font loading failed, using Canvas fallback:`, fontError);
          setUseCanvasRenderer(true);
          setIsReady(true);
        }
      } catch (error) {
        console.error(`[SmartTextRenderer] Critical error during initialization:`, error);
        // Fallback to Canvas renderer on any error
        setUseCanvasRenderer(true);
        setHasError(false); // Don't show as error, just use fallback
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

  console.log(`[SmartTextRenderer] Rendering with ${useCanvasRenderer ? 'Canvas' : 'Three.js'}: "${safeText}"`);

  // Wrap in error boundary-like try-catch
  try {
    if (useCanvasRenderer) {
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
    }

    return (
      <SimpleText
        text={safeText}
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
  } catch (renderError) {
    console.error('[SmartTextRenderer] Render error, falling back to Canvas:', renderError);
    
    // Emergency fallback to Canvas renderer
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
  }
};

export default SmartTextRenderer;
