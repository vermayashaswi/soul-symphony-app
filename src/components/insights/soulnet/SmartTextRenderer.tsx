
import React, { useState, useEffect } from 'react';
import { enhancedFontService } from '@/services/enhancedFontService';
import { shouldUseMultiLineRendering } from '@/utils/textWrappingUtils';
import CanvasTextRenderer from './CanvasTextRenderer';
import IntelligentTextRenderer from './IntelligentTextRenderer';

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
  const [useCanvasRenderer, setUseCanvasRenderer] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const initializeRenderer = async () => {
      try {
        const isComplex = enhancedFontService.isComplexScript(text);
        const needsMultiLine = shouldUseMultiLineRendering(text, 18);
        
        // For larger text sizes (> 2.0), prefer Canvas renderer for better quality
        const preferCanvas = size > 2.0;
        
        if (isComplex || preferCanvas) {
          console.log(`[SmartTextRenderer] Using Canvas renderer for: "${text}" (complex: ${isComplex}, large text: ${preferCanvas})`);
          setUseCanvasRenderer(true);
          setFontLoaded(true);
        } else if (needsMultiLine) {
          console.log(`[SmartTextRenderer] Using Intelligent renderer for multi-line text: "${text}"`);
          setUseCanvasRenderer(false);
          setFontLoaded(true);
        } else {
          console.log(`[SmartTextRenderer] Simple script detected for: "${text}", attempting Three.js font loading`);
          try {
            await enhancedFontService.loadFont(text);
            setUseCanvasRenderer(false);
            setFontLoaded(true);
            console.log(`[SmartTextRenderer] Three.js font loaded successfully for: "${text}"`);
          } catch (error) {
            console.warn(`[SmartTextRenderer] Three.js font loading failed for: "${text}", falling back to Intelligent renderer`, error);
            setUseCanvasRenderer(false);
            setFontLoaded(true);
          }
        }
      } catch (error) {
        console.error(`[SmartTextRenderer] Error initializing renderer for: "${text}"`, error);
        setHasError(true);
      }
    };

    initializeRenderer();
  }, [text, size]);

  if (!visible || hasError || !fontLoaded) {
    return null;
  }

  if (useCanvasRenderer) {
    return (
      <CanvasTextRenderer
        text={text}
        position={position}
        color={color}
        size={size}
        visible={visible}
        renderOrder={renderOrder}
        bold={bold}
        maxWidth={maxWidth}
      />
    );
  }

  // Use IntelligentTextRenderer for consistent 18-character wrapping
  return (
    <IntelligentTextRenderer
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
      maxCharsPerLine={18}
      maxLines={2}
    />
  );
};

export default SmartTextRenderer;
