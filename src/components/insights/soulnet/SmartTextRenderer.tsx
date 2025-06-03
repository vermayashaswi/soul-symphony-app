
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
  enableWrapping?: boolean;
}

// ENHANCED: Intelligent text splitting function
const intelligentTextSplit = (text: string, maxCharsPerLine: number = 12): string => {
  if (!text || text.length <= maxCharsPerLine) {
    return text;
  }

  const words = text.split(/[\s&]+/); // Split on spaces and ampersands
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    // If adding this word would exceed the limit
    if (currentLine.length > 0 && (currentLine + ' ' + word).length > maxCharsPerLine) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = currentLine.length > 0 ? currentLine + ' ' + word : word;
    }
  }

  // Add the last line if it has content
  if (currentLine.trim().length > 0) {
    lines.push(currentLine.trim());
  }

  // Join with newlines, but limit to 3 lines max to prevent excessive height
  const result = lines.slice(0, 3).join('\n');
  
  // If we had to truncate, add ellipsis to the last line
  if (lines.length > 3) {
    const truncatedLines = lines.slice(0, 2);
    const lastLine = lines[2];
    if (lastLine.length > maxCharsPerLine - 3) {
      truncatedLines.push(lastLine.substring(0, maxCharsPerLine - 3) + '...');
    } else {
      truncatedLines.push(lastLine + '...');
    }
    return truncatedLines.join('\n');
  }

  console.log(`[SmartTextRenderer] Intelligent split: "${text}" -> "${result}"`);
  return result;
};

export const SmartTextRenderer: React.FC<SmartTextRendererProps> = ({
  text,
  position,
  color = '#000000', // Default to black
  size = 0.4,
  visible = true,
  renderOrder = 10,
  bold = false,
  outlineWidth = 0.02,
  outlineColor = '#f5f5f5', // Light outline for contrast
  maxWidth = 25,
  enableWrapping = false
}) => {
  const [useCanvasRenderer, setUseCanvasRenderer] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [processedText, setProcessedText] = useState(text);

  // ENHANCED: Process text for better wrapping
  useEffect(() => {
    if (enableWrapping && text) {
      // Calculate optimal characters per line based on size and maxWidth
      const baseCharsPerLine = Math.max(8, Math.min(15, Math.floor(maxWidth / (size * 8))));
      const wrappedText = intelligentTextSplit(text, baseCharsPerLine);
      setProcessedText(wrappedText);
      console.log(`[SmartTextRenderer] Text processing: "${text}" -> "${wrappedText}" (charsPerLine: ${baseCharsPerLine})`);
    } else {
      setProcessedText(text);
    }
  }, [text, enableWrapping, size, maxWidth]);

  useEffect(() => {
    const initializeRenderer = async () => {
      try {
        const isComplex = enhancedFontService.isComplexScript(processedText);
        
        // For larger text sizes (> 2.0) or when wrapping is needed, prefer Canvas renderer for better quality
        const preferCanvas = size > 2.0 || enableWrapping;
        
        if (isComplex || preferCanvas) {
          console.log(`[SmartTextRenderer] Using Canvas renderer for: "${processedText}" (complex: ${isComplex}, large text: ${preferCanvas}, wrapping: ${enableWrapping})`);
          setUseCanvasRenderer(true);
          setFontLoaded(true);
        } else {
          console.log(`[SmartTextRenderer] Simple script detected for: "${processedText}", attempting Three.js font loading`);
          try {
            await enhancedFontService.loadFont(processedText);
            setUseCanvasRenderer(false);
            setFontLoaded(true);
            console.log(`[SmartTextRenderer] Three.js font loaded successfully for: "${processedText}"`);
          } catch (error) {
            console.warn(`[SmartTextRenderer] Three.js font loading failed for: "${processedText}", falling back to Canvas`, error);
            setUseCanvasRenderer(true);
            setFontLoaded(true);
          }
        }
      } catch (error) {
        console.error(`[SmartTextRenderer] Error initializing renderer for: "${processedText}"`, error);
        setHasError(true);
      }
    };

    initializeRenderer();
  }, [processedText, size, enableWrapping]);

  if (!visible || hasError || !fontLoaded) {
    return null;
  }

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
        maxWidth={maxWidth}
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
      maxWidth={maxWidth}
      enableWrapping={enableWrapping}
    />
  );
};

export default SmartTextRenderer;
