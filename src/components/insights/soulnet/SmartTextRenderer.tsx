
import React, { useState, useEffect } from 'react';
import { enhancedFontService } from '@/services/enhancedFontService';
import CanvasTextRenderer from './CanvasTextRenderer';
import SimpleText from './SimpleText';

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
        
        if (isComplex) {
          console.log(`[SmartTextRenderer] Complex script detected for: "${text}", using Canvas renderer`);
          setUseCanvasRenderer(true);
          setFontLoaded(true);
        } else {
          console.log(`[SmartTextRenderer] Simple script detected for: "${text}", attempting Three.js font loading`);
          try {
            await enhancedFontService.loadFont(text);
            setUseCanvasRenderer(false);
            setFontLoaded(true);
            console.log(`[SmartTextRenderer] Three.js font loaded successfully for: "${text}"`);
          } catch (error) {
            console.warn(`[SmartTextRenderer] Three.js font loading failed for: "${text}", falling back to Canvas`, error);
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
  }, [text]);

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

  return (
    <SimpleText
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
