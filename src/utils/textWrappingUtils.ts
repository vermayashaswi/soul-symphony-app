
/**
 * Universal text wrapping utilities for consistent display across all languages
 */

interface WrappedText {
  lines: string[];
  isTruncated: boolean;
  originalLength: number;
}

/**
 * Wraps text to a maximum of 18 characters per line with intelligent two-line support
 */
export const wrapTextIntelligently = (text: string, maxCharsPerLine: number = 18, maxLines: number = 2): WrappedText => {
  if (!text || typeof text !== 'string') {
    return { lines: ['Node'], isTruncated: false, originalLength: 0 };
  }

  const cleanText = text.trim();
  if (cleanText.length === 0) {
    return { lines: ['Node'], isTruncated: false, originalLength: 0 };
  }

  // If text fits in one line, return as-is
  if (cleanText.length <= maxCharsPerLine) {
    return { lines: [cleanText], isTruncated: false, originalLength: cleanText.length };
  }

  // For text longer than one line, implement intelligent wrapping
  const words = cleanText.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    // If adding this word would exceed the line limit
    if ((currentLine + (currentLine ? ' ' : '') + word).length > maxCharsPerLine) {
      // If we have a current line, save it
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word is too long for a line, truncate it
        currentLine = word.substring(0, maxCharsPerLine - 3) + '...';
        lines.push(currentLine);
        currentLine = '';
      }

      // If we've reached max lines, break
      if (lines.length >= maxLines) {
        break;
      }
    } else {
      // Add word to current line
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }

  // Add remaining text if there's space
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  // If we have more content that couldn't fit, truncate the last line
  let isTruncated = false;
  if (lines.length === maxLines && words.length > 0) {
    const remainingText = words.slice(words.findIndex(word => 
      lines.join(' ').includes(word)) + lines.join(' ').split(' ').length
    ).join(' ');
    
    if (remainingText.length > 0) {
      isTruncated = true;
      // Ensure last line ends with ellipsis if truncated
      const lastLine = lines[lines.length - 1];
      if (lastLine.length > maxCharsPerLine - 3) {
        lines[lines.length - 1] = lastLine.substring(0, maxCharsPerLine - 3) + '...';
      } else if (!lastLine.endsWith('...')) {
        lines[lines.length - 1] = lastLine + '...';
      }
    }
  }

  return {
    lines: lines.length > 0 ? lines : [cleanText.substring(0, maxCharsPerLine)],
    isTruncated,
    originalLength: cleanText.length
  };
};

/**
 * Calculates the optimal vertical spacing for multi-line text
 */
export const calculateVerticalSpacing = (lineCount: number, fontSize: number): number => {
  if (lineCount <= 1) return 0;
  
  // Standard line height is typically 1.2 times the font size
  const lineHeight = fontSize * 1.2;
  return (lineCount - 1) * lineHeight * 0.5; // Center the text block
};

/**
 * Determines if text should use multi-line rendering
 */
export const shouldUseMultiLineRendering = (text: string, maxCharsPerLine: number = 18): boolean => {
  if (!text) return false;
  return text.trim().length > maxCharsPerLine;
};

/**
 * Language-specific breaking rules for better text wrapping
 */
export const hasLanguageSpecificBreaking = (text: string): boolean => {
  // Check for CJK characters (Chinese, Japanese, Korean)
  const cjkRegex = /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff]/;
  
  // Check for Arabic/Hebrew (RTL languages)
  const rtlRegex = /[\u0590-\u05ff\u0600-\u06ff\u0750-\u077f]/;
  
  return cjkRegex.test(text) || rtlRegex.test(text);
};
