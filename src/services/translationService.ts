
import { supabase } from '@/integrations/supabase/client';
import { translationCache } from './translationCache';
import { toast } from 'sonner';

interface TranslationRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  entryId?: number;
}

interface BatchTranslationRequest {
  texts: string[];
  targetLanguage: string;
}

// ENHANCED: Text validation utilities
function isValidTranslationText(text: string): boolean {
  return typeof text === 'string' && text.trim().length > 0;
}

function filterValidTexts(texts: string[]): string[] {
  return texts.filter(text => isValidTranslationText(text));
}

export class TranslationService {
  private static readonly BATCH_SIZE = 50;
  private static readonly MAX_RETRIES = 3;
  
  static async translateText(text: string, targetLanguage: string, sourceLanguage: string = 'en'): Promise<string> {
    try {
      // ENHANCED: Strict text validation
      if (!isValidTranslationText(text)) {
        console.warn(`[TranslationService] Invalid text provided: "${text}"`);
        return text;
      }
      
      // Check cache first
      const cached = await translationCache.getTranslation(text, targetLanguage);
      if (cached) {
        return cached.translatedText;
      }

      console.log(`[TranslationService] Translating: "${text.substring(0, 50)}..." to ${targetLanguage}`);

      // Call the edge function for translation
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          text: text.trim(), // Ensure trimmed text
          sourceLanguage: sourceLanguage,
          targetLanguage: targetLanguage,
        },
      });

      if (error) {
        console.error('Translation error:', error);
        toast.error('Translation failed. Falling back to original text.');
        return text;
      }

      if (!data || !data.translatedText) {
        console.error('Translation response missing translatedText:', data);
        return text;
      }

      // Cache the translation
      await translationCache.setTranslation({
        originalText: text,
        translatedText: data.translatedText,
        language: targetLanguage,
        timestamp: Date.now(),
        version: 1,
      });

      console.log(`[TranslationService] Translation successful: "${text}" -> "${data.translatedText}"`);
      return data.translatedText;
    } catch (error) {
      console.error('Translation service error:', error);
      toast.error('Translation service error. Using original text.');
      return text;
    }
  }

  static async batchTranslate(request: BatchTranslationRequest): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // ENHANCED: Filter out invalid texts before processing
    const validTexts = filterValidTexts(request.texts);
    
    if (validTexts.length === 0) {
      console.warn('[TranslationService] No valid texts to translate');
      return results;
    }

    console.log(`[TranslationService] Batch translating ${validTexts.length} valid texts (${request.texts.length - validTexts.length} invalid filtered out)`);

    const needsTranslation: string[] = [];

    // Check cache first for all valid texts
    for (const text of validTexts) {
      const cached = await translationCache.getTranslation(text, request.targetLanguage);
      if (cached) {
        results.set(text, cached.translatedText);
      } else {
        needsTranslation.push(text);
      }
    }

    if (needsTranslation.length === 0) {
      console.log('[TranslationService] All texts found in cache');
      return results;
    }

    console.log(`[TranslationService] ${needsTranslation.length} texts need translation`);

    // Split remaining texts into batches
    for (let i = 0; i < needsTranslation.length; i += this.BATCH_SIZE) {
      const batch = needsTranslation.slice(i, i + this.BATCH_SIZE);
      
      try {
        console.log(`[TranslationService] Processing batch ${Math.floor(i / this.BATCH_SIZE) + 1}: ${batch.length} texts`);
        
        const { data, error } = await supabase.functions.invoke('translate-text', {
          body: {
            texts: batch,
            targetLanguage: request.targetLanguage,
          },
        });

        if (error) {
          console.error(`[TranslationService] Batch translation error:`, error);
          batch.forEach(text => results.set(text, text));
          continue;
        }

        if (data && data.translationMap) {
          // Use translation map for better mapping
          Object.entries(data.translationMap).forEach(([originalText, translatedText]) => {
            results.set(originalText, translatedText as string);
            translationCache.setTranslation({
              originalText,
              translatedText: translatedText as string,
              language: request.targetLanguage,
              timestamp: Date.now(),
              version: 1,
            });
          });
          console.log(`[TranslationService] Batch ${Math.floor(i / this.BATCH_SIZE) + 1} completed successfully`);
        } else if (data && data.translatedTexts && Array.isArray(data.translatedTexts)) {
          // Fallback to array mapping
          batch.forEach((text, index) => {
            const translatedText = data.translatedTexts[index] || text;
            results.set(text, translatedText);
            translationCache.setTranslation({
              originalText: text,
              translatedText,
              language: request.targetLanguage,
              timestamp: Date.now(),
              version: 1,
            });
          });
          console.log(`[TranslationService] Batch ${Math.floor(i / this.BATCH_SIZE) + 1} completed with fallback mapping`);
        } else {
          console.error('Invalid batch translation response format:', data);
          batch.forEach(text => results.set(text, text));
        }
      } catch (error) {
        console.error(`[TranslationService] Batch translation error for batch ${Math.floor(i / this.BATCH_SIZE) + 1}:`, error);
        batch.forEach(text => results.set(text, text));
      }
    }

    console.log(`[TranslationService] Batch translation complete: ${results.size} results`);
    return results;
  }
}

// Export a singleton instance for backwards compatibility
export const translationService = {
  translateText: TranslationService.translateText,
  batchTranslate: TranslationService.batchTranslate
};
