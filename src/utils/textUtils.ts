
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
  
  // Check for line breaks which force new lines
  const lineBreaks = (text.match(/\n/g) || []).length;
  if (lineBreaks >= maxLines) return true;
  
  // Adjust for the possibility of words wrapping
  const totalChars = text.length;
  const avgWordLength = 6; // Estimated average word length in English
  
  // This approach estimates how many characters can fit in the specified line height
  // and then adjusts based on word-wrapping behavior
  const estimatedLines = Math.ceil(totalChars / (lineHeight - Math.min(avgWordLength - 1, lineHeight * 0.2)));
  
  return estimatedLines > maxLines || lineBreaks > 0 && estimatedLines + lineBreaks > maxLines;
};

/**
 * Checks if a journal entry is still being processed
 */
export const isEntryProcessing = (entry: any): boolean => {
  if (!entry) return false;
  
  // Check for explicit processing flags
  if (entry.processing === true) return true;
  
  // Check for processing content indicators
  if (entry.content === "Processing entry..." || entry.content === "Loading...") return true;
  
  // Check for temp ID but no permanent ID
  if (entry.tempId && !entry.id) return true;
  
  // Check for missing essential data that should be present if processing is complete
  if (!entry.content && !entry["refined text"] && !entry["transcription text"]) return true;
  
  return false;
};
