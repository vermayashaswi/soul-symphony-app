
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
 * Returns true if the text is long enough to benefit from expand/collapse functionality
 * @param text Text content to check
 */
export const textWillOverflow = (text: string): boolean => {
  if (!text) return false;
  
  // Check for line breaks which indicate multiple paragraphs
  const lineBreaks = (text.match(/\n/g) || []).length;
  
  // Consider text as "long" if it's more than 280 characters or has multiple paragraphs
  return text.length > 280 || lineBreaks > 0;
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
