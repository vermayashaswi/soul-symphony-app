
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
  cameraZoom?: number;
  enableWrapping?: boolean;
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
  maxWidth = 25,
  cameraZoom = 45,
  enableWrapping = true
}) => {
  const [useCanvasRenderer, setUseCanvasRenderer] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const initializeRenderer = async () => {
      try {
        const isComplex = enhancedFontService.isComplexScript(text);
        
        // For larger text sizes (> 2.0), prefer Canvas renderer for better quality
        const preferCanvas = size > 2.0;
        
        // For wrapped text, prefer Canvas renderer for better control
        const needsWrapping = enableWrapping && text && text.length > 20;
        
        if (isComplex || preferCanvas || needsWrapping) {
          console.log(`[SmartTextRenderer] Using Canvas renderer for: "${text}" (complex: ${isComplex}, large text: ${preferCanvas}, needs wrapping: ${needsWrapping})`);
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
  }, [text, size, enableWrapping]);

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
        cameraZoom={cameraZoom}
        enableWrapping={enableWrapping}
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
      cameraZoom={cameraZoom}
      enableWrapping={enableWrapping}
    />
  );
};

export default SmartTextRenderer;
