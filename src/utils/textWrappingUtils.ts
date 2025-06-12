
/**
 * Text wrapping utilities for intelligent text splitting
 */

export interface WrappedTextResult {
  lines: string[];
  totalLines: number;
  longestLineLength: number;
}

/**
 * Intelligently wraps text at natural break points with character limit per line
 */
export const wrapTextIntelligently = (
  text: string, 
  maxCharsPerLine: number = 14, // UPDATED: Reduced from 18 to 14
  maxLines: number = 3
): WrappedTextResult => {
  if (!text || typeof text !== 'string') {
    return { lines: ['Node'], totalLines: 1, longestLineLength: 4 };
  }

  const cleanText = text.trim();
  if (cleanText.length === 0) {
    return { lines: ['Node'], totalLines: 1, longestLineLength: 4 };
  }

  // If text is short enough, return as single line
  if (cleanText.length <= maxCharsPerLine) {
    return { 
      lines: [cleanText], 
      totalLines: 1, 
      longestLineLength: cleanText.length 
    };
  }

  const lines: string[] = [];
  const words = cleanText.split(/\s+/);
  let currentLine = '';

  for (const word of words) {
    // If adding this word would exceed the character limit
    if (currentLine.length + word.length + 1 > maxCharsPerLine) {
      // If we have a current line, add it to lines
      if (currentLine.length > 0) {
        lines.push(currentLine.trim());
        currentLine = '';
      }
      
      // If the word itself is longer than maxCharsPerLine, split it
      if (word.length > maxCharsPerLine) {
        const chunks = splitLongWord(word, maxCharsPerLine);
        lines.push(...chunks.slice(0, maxLines - lines.length));
        if (lines.length >= maxLines) break;
      } else {
        currentLine = word;
      }
    } else {
      // Add word to current line
      currentLine = currentLine.length > 0 ? `${currentLine} ${word}` : word;
    }

    // Check if we've reached max lines
    if (lines.length >= maxLines) break;
  }

  // Add remaining current line if not empty and we haven't reached max lines
  if (currentLine.length > 0 && lines.length < maxLines) {
    lines.push(currentLine.trim());
  }

  // If we had to truncate, add ellipsis to last line
  if (lines.length === maxLines && (words.length > lines.join(' ').split(' ').length)) {
    const lastLine = lines[lines.length - 1];
    if (lastLine.length > maxCharsPerLine - 3) {
      lines[lines.length - 1] = lastLine.substring(0, maxCharsPerLine - 3) + '...';
    } else {
      lines[lines.length - 1] = lastLine + '...';
    }
  }

  const longestLineLength = Math.max(...lines.map(line => line.length));

  return {
    lines,
    totalLines: lines.length,
    longestLineLength
  };
};

/**
 * Splits a long word into chunks that fit within the character limit
 */
const splitLongWord = (word: string, maxChars: number): string[] => {
  const chunks: string[] = [];
  let remaining = word;

  while (remaining.length > maxChars) {
    // Try to split at natural break points first (hyphens, underscores)
    const breakPoint = findNaturalBreakPoint(remaining, maxChars);
    
    if (breakPoint > 0) {
      chunks.push(remaining.substring(0, breakPoint));
      remaining = remaining.substring(breakPoint);
    } else {
      // No natural break point, just split at maxChars
      chunks.push(remaining.substring(0, maxChars));
      remaining = remaining.substring(maxChars);
    }
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
};

/**
 * Finds natural break points in a word (hyphens, underscores, etc.)
 */
const findNaturalBreakPoint = (word: string, maxChars: number): number => {
  const naturalBreaks = ['-', '_', '.'];
  let bestBreak = -1;

  for (let i = Math.min(maxChars, word.length) - 1; i > 0; i--) {
    if (naturalBreaks.includes(word[i])) {
      bestBreak = i + 1; // Include the break character
      break;
    }
  }

  return bestBreak;
};

/**
 * Calculates optimal maxWidth for Three.js Text component based on wrapped text
 */
export const calculateOptimalMaxWidth = (
  wrappedText: WrappedTextResult,
  fontSize: number = 0.4
): number => {
  // Base width calculation: average character width * longest line * font size
  const avgCharWidth = 0.6; // Approximate character width ratio
  const baseWidth = wrappedText.longestLineLength * avgCharWidth * fontSize;
  
  // Add some padding for better readability
  const padding = fontSize * 0.5;
  
  return Math.max(baseWidth + padding, fontSize * 5); // Minimum width
};
