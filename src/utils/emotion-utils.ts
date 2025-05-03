
/**
 * Utility functions for emotion name handling and translation
 */

// Map of common emotions with their Hindi translations
export const emotionTranslationMap: Record<string, Record<string, string>> = {
  hi: {
    'Happy': 'खुश',
    'Sad': 'दुखी',
    'Angry': 'क्रोधित',
    'Anxious': 'चिंतित',
    'Peaceful': 'शांत',
    'Joyful': 'आनंदित',
    'Joy': 'आनंद',
    'Excited': 'उत्साहित',
    'Fearful': 'भयभीत',
    'Content': 'संतुष्ट',
    'Frustrated': 'निराश',
    'Calm': 'शांत',
    'Love': 'प्यार',
    'Gratitude': 'कृतज्ञता',
    'Hope': 'आशा',
    'Family': 'परिवार',
    'Friend': 'मित्र',
    'Work': 'काम',
    'Health': 'स्वास्थ्य',
    'Success': 'सफलता',
    'Surprised': 'आश्चर्यचकित',
    'Confused': 'भ्रमित',
    'Disappointed': 'निराश',
    'Proud': 'गर्वित',
    'Relaxed': 'आराम से',
    'Stressed': 'तनावग्रस्त',
    'Tired': 'थका हुआ',
    'Bored': 'ऊबा हुआ',
    'Satisfied': 'संतुष्ट',
    'Hopeful': 'उम्मीदवार',
    'Motivated': 'प्रेरित',
    'Confident': 'आत्मविश्वासी',
    'Curious': 'जिज्ञासु',
    'Optimistic': 'आशावादी',
    'Pessimistic': 'निराशावादी',
    'Overwhelmed': 'अभिभूत',
    'Worried': 'चिंतित'
  }
};

/**
 * Clean an emotion name for better translation
 * @param text The emotion name to clean
 * @returns Cleaned emotion name
 */
export const cleanEmotionName = (text: string): string => {
  if (!text) return '';
  
  // Remove any strange punctuation or formatting that might affect translation
  let cleaned = text.trim()
    .replace(/\s*[.,;:!?]\s*$/, '')  // Remove trailing punctuation
    .replace(/^\s*[.,;:!?]\s*/, '')  // Remove leading punctuation
    .replace(/\s{2,}/g, ' ')        // Replace multiple spaces with single space
    .replace(/[_\-+]/g, ' ')       // Replace underscores, hyphens with spaces
    .replace(/[0-9.]+%?/g, '')      // Remove any numbers and percentages
    .replace(/\.{2,}/g, '');        // Remove ellipses
  
  // Capitalize first letter for consistency
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  
  return cleaned;
};

/**
 * Check if a text is likely an emotion name
 * @param text The text to check
 * @returns True if the text is likely an emotion name
 */
export const isEmotionName = (text: string): boolean => {
  // Common emotion names - expand this list as needed
  const commonEmotions = [
    'happy', 'sad', 'angry', 'anxious', 'peaceful', 'joyful',
    'excited', 'fearful', 'content', 'frustrated', 'calm', 'love',
    'gratitude', 'hope', 'family', 'friend', 'work', 'health',
    'joy', 'surprise', 'fear', 'disgust', 'trust', 'anticipation'
  ];
  
  const normalized = text.toLowerCase().trim();
  return commonEmotions.some(emotion => normalized.includes(emotion)) || 
         /^[a-zA-Z]+$/.test(text); // Text that's just a single word is likely an emotion
};

/**
 * Check if text is a percentage value
 * @param text The text to check
 * @returns True if the text is a percentage value
 */
export const isPercentage = (text: string): boolean => {
  return /^\d+%\.?\.?\.?$/.test(text);
};

/**
 * Get a direct translation for an emotion name if available
 * @param text The emotion name
 * @param language The target language code
 * @returns The direct translation if available, or null
 */
export const getDirectEmotionTranslation = (text: string, language: string): string | null => {
  const cleaned = cleanEmotionName(text);
  
  if (language in emotionTranslationMap && cleaned in emotionTranslationMap[language]) {
    return emotionTranslationMap[language][cleaned];
  }
  
  return null;
};
