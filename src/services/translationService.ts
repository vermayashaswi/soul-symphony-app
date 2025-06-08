
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

export class TranslationService {
  private static readonly BATCH_SIZE = 250; // Increased from 50 to 250
  private static readonly MAX_RETRIES = 3;
  
  static async translateText(text: string, targetLanguage: string, sourceLanguage: string = 'en'): Promise<string> {
    try {
      // Skip empty or whitespace-only strings
      if (!text || text.trim() === '') {
        return text;
      }
      
      // Check cache first
      const cached = await translationCache.getTranslation(text, targetLanguage);
      if (cached) {
        return cached.translatedText;
      }

      // Call the edge function for translation
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          text: text,
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

      return data.translatedText;
    } catch (error) {
      console.error('Translation service error:', error);
      toast.error('Translation service error. Using original text.');
      return text;
    }
  }

  static async batchTranslate(request: BatchTranslationRequest): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const needsTranslation: string[] = [];

    // Filter out empty strings
    const validTexts = request.texts.filter(text => text && text.trim() !== '');
    
    if (validTexts.length === 0) {
      return results;
    }

    console.log(`[TranslationService] Batch translating ${validTexts.length} texts to ${request.targetLanguage}`);

    // Check cache first for all texts
    for (const text of validTexts) {
      const cached = await translationCache.getTranslation(text, request.targetLanguage);
      if (cached) {
        results.set(text, cached.translatedText);
      } else {
        needsTranslation.push(text);
      }
    }

    console.log(`[TranslationService] Found ${results.size} cached, need to translate ${needsTranslation.length}`);

    // Split remaining texts into batches of 250
    for (let i = 0; i < needsTranslation.length; i += this.BATCH_SIZE) {
      const batch = needsTranslation.slice(i, i + this.BATCH_SIZE);
      let retryCount = 0;
      let batchSuccess = false;

      console.log(`[TranslationService] Processing batch ${Math.floor(i / this.BATCH_SIZE) + 1} with ${batch.length} texts`);

      while (retryCount < this.MAX_RETRIES && !batchSuccess) {
        try {
          const { data, error } = await supabase.functions.invoke('translate-text', {
            body: {
              texts: batch,
              targetLanguage: request.targetLanguage,
            },
          });

          if (error) {
            console.error(`[TranslationService] Batch translation error (attempt ${retryCount + 1}):`, error);
            throw error;
          }

          if (data && data.translatedTexts && Array.isArray(data.translatedTexts)) {
            // Cache and store results
            batch.forEach((text, index) => {
              const translatedText = data.translatedTexts[index] || text; // Fallback to original
              results.set(text, translatedText);
              
              // Cache successful translations
              if (translatedText !== text) {
                translationCache.setTranslation({
                  originalText: text,
                  translatedText,
                  language: request.targetLanguage,
                  timestamp: Date.now(),
                  version: 1,
                });
              }
            });
            batchSuccess = true;
            console.log(`[TranslationService] Successfully processed batch with ${batch.length} translations`);
          } else {
            throw new Error('Invalid response format for batch translation');
          }
        } catch (error) {
          retryCount++;
          console.error(`[TranslationService] Batch translation attempt ${retryCount} failed:`, error);
          
          if (retryCount >= this.MAX_RETRIES) {
            console.error(`[TranslationService] Max retries reached for batch, using fallback`);
            // Fallback: try individual translations for this batch
            await this.fallbackIndividualTranslations(batch, request.targetLanguage, results);
            batchSuccess = true; // Mark as handled
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }
    }

    console.log(`[TranslationService] Batch translation complete: ${results.size} total results`);
    return results;
  }

  private static async fallbackIndividualTranslations(
    batch: string[], 
    targetLanguage: string, 
    results: Map<string, string>
  ): Promise<void> {
    console.log(`[TranslationService] Falling back to individual translations for ${batch.length} texts`);
    
    for (const text of batch) {
      try {
        const translated = await this.translateText(text, targetLanguage);
        results.set(text, translated);
      } catch (error) {
        console.error(`[TranslationService] Individual translation failed for "${text}":`, error);
        results.set(text, text); // Use original text as last resort
      }
    }
  }
}

// Export a singleton instance for backwards compatibility
export const translationService = {
  translateText: TranslationService.translateText,
  batchTranslate: TranslationService.batchTranslate
};
