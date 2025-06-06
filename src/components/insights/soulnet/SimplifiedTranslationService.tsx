
import { SoulNetTranslationPreloader } from '@/services/soulnetTranslationPreloader';

// Simplified translation lookup for SoulNet components
export const getNodeTranslation = (
  text: string,
  language: string,
  userId?: string,
  timeRange?: string
): string => {
  try {
    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.warn(`[SimplifiedTranslationService] Invalid text: "${text}"`);
      return text;
    }

    // Return original for English
    if (language === 'en') {
      return text;
    }

    // Try to get preloaded translation
    if (userId && timeRange) {
      const translation = SoulNetTranslationPreloader.getTranslationSync(
        text,
        language,
        userId,
        timeRange
      );

      if (translation && typeof translation === 'string' && translation.trim().length > 0) {
        console.log(`[SimplifiedTranslationService] Translation found: "${text}" -> "${translation}"`);
        return translation;
      }
    }

    console.log(`[SimplifiedTranslationService] No translation found, using original: "${text}"`);
    return text;
  } catch (error) {
    console.error(`[SimplifiedTranslationService] Error getting translation:`, error);
    return text;
  }
};

export const isTranslationReady = (
  language: string,
  userId?: string,
  timeRange?: string
): boolean => {
  if (language === 'en') {
    return true;
  }

  // For non-English languages, we assume translations are ready if we have the required parameters
  return !!(userId && timeRange);
};
