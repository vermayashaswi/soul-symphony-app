
/**
 * Text utility functions for formatting and manipulating text
 */
import { format } from 'date-fns';
import { useTranslation } from '@/contexts/TranslationContext';
import { staticTranslationService } from '@/services/staticTranslationService';

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
 * Now supports multiple languages
 */
export const formatTimestamp = (timestamp: string, language: string = 'en'): string => {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    
    // Format date based on language using date-fns
    const formattedDate = format(date, 'PPpp', {
      // You can add locale-specific options if needed
    });
    
    // For languages other than English, use translation service
    if (language !== 'en') {
      // This could be replaced with an async function, but for simplicity 
      // we'll use a synchronous approach here
      try {
        const translated = staticTranslationService.translateTextSync(formattedDate, language);
        return translated || formattedDate;
      } catch (error) {
        console.error('Error translating date:', error);
        return formattedDate;
      }
    }
    
    return formattedDate;
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return timestamp;
  }
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
 * Hook to get a translated date from timestamp
 */
export const useFormattedDate = (timestamp: string): string => {
  const { currentLanguage } = useTranslation();
  return formatTimestamp(timestamp, currentLanguage);
};
