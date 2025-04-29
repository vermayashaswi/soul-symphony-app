
/**
 * Text utility functions for formatting and manipulating text
 */

/**
 * Truncates text to a specified length and adds ellipsis if needed
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (!text) return '';
  
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength) + '...';
};

/**
 * Capitalizes the first letter of a string
 */
export const capitalizeFirstLetter = (text: string): string => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Formats a timestamp string to a user-friendly date string
 */
export const formatTimestamp = (timestamp: string): string => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Extracts a summary from text (first N words)
 */
export const extractSummary = (text: string, wordCount: number = 20): string => {
  if (!text) return '';
  
  const words = text.split(' ');
  if (words.length <= wordCount) {
    return text;
  }
  
  return words.slice(0, wordCount).join(' ') + '...';
};

/**
 * Returns true if the text is likely to overflow when limited to the specified number of lines
 * @param text Text content to check
 * @param lineHeight Approximate line height in characters
 * @param maxLines Maximum number of lines before overflow
 */
export const textWillOverflow = (text: string, lineHeight = 60, maxLines = 3): boolean => {
  if (!text) return false;
  
  // Rough estimation - average character count per line
  const totalChars = text.length;
  const estimatedLines = Math.ceil(totalChars / lineHeight);
  
  return estimatedLines > maxLines;
};
