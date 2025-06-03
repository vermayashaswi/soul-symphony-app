
/**
 * Text wrapping utilities for 3D visualization labels
 */

export interface WrappedTextLine {
  text: string;
  width: number;
}

export interface WrappedTextResult {
  lines: WrappedTextLine[];
  totalHeight: number;
  maxWidth: number;
}

/**
 * Measures text width using canvas context
 */
export const measureTextWidth = (
  text: string, 
  fontSize: number, 
  fontFamily: string = 'Arial, sans-serif',
  fontWeight: string = 'normal'
): number => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return text.length * fontSize * 0.6; // Fallback estimation

  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  return context.measureText(text).width;
};

/**
 * Wraps text to fit within specified width with intelligent word breaking
 */
export const wrapText = (
  text: string,
  maxWidth: number,
  fontSize: number,
  fontFamily: string = 'Arial, sans-serif',
  fontWeight: string = 'normal'
): WrappedTextResult => {
  if (!text || text.trim().length === 0) {
    return { lines: [], totalHeight: 0, maxWidth: 0 };
  }

  const words = text.trim().split(/\s+/);
  const lines: WrappedTextLine[] = [];
  let currentLine = '';
  let actualMaxWidth = 0;

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = measureTextWidth(testLine, fontSize, fontFamily, fontWeight);

    if (testWidth <= maxWidth || currentLine === '') {
      // Word fits on current line or it's the first word
      currentLine = testLine;
    } else {
      // Word doesn't fit, start new line
      if (currentLine) {
        const lineWidth = measureTextWidth(currentLine, fontSize, fontFamily, fontWeight);
        lines.push({ text: currentLine, width: lineWidth });
        actualMaxWidth = Math.max(actualMaxWidth, lineWidth);
      }
      currentLine = word;
    }
  }

  // Add the last line
  if (currentLine) {
    const lineWidth = measureTextWidth(currentLine, fontSize, fontFamily, fontWeight);
    lines.push({ text: currentLine, width: lineWidth });
    actualMaxWidth = Math.max(actualMaxWidth, lineWidth);
  }

  // UPDATED: Reduced line height multiplier from 1.2 to 1.1 for tighter spacing
  const lineHeight = fontSize * 1.1;
  const totalHeight = lines.length * lineHeight;

  return {
    lines,
    totalHeight,
    maxWidth: actualMaxWidth
  };
};

/**
 * Calculates optimal font size based on zoom level for responsive text
 */
export const getResponsiveFontSize = (
  baseSize: number,
  zoomLevel: number,
  minSize: number = 12,
  maxSize: number = 48
): number => {
  // Zoom level typically ranges from 10-100
  const normalizedZoom = Math.max(10, Math.min(100, zoomLevel));
  const zoomFactor = (50 - normalizedZoom) * 0.02 + 1;
  const responsiveSize = baseSize * zoomFactor;
  
  return Math.max(minSize, Math.min(maxSize, responsiveSize));
};

/**
 * Calculates optimal text width based on zoom level
 */
export const getResponsiveMaxWidth = (
  baseWidth: number,
  zoomLevel: number,
  minWidth: number = 100,
  maxWidth: number = 400
): number => {
  const normalizedZoom = Math.max(10, Math.min(100, zoomLevel));
  const zoomFactor = (normalizedZoom - 10) * 0.01 + 1;
  const responsiveWidth = baseWidth * zoomFactor;
  
  return Math.max(minWidth, Math.min(maxWidth, responsiveWidth));
};
