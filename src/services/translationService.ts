
import { translationCache } from './translationCache';
import { supabase } from '@/integrations/supabase/client';

class TranslationService {
  private apiKey: string | null = null;
  
  // NEW: Batch operation tracking
  private batchOperations = new Map<string, Promise<Map<string, string>>>();

  async setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  private hasApiKey(): boolean {
    return !!this.apiKey;
  }

  async translate(text: string, sourceLanguage: string = 'auto', targetLanguage?: string): Promise<string | null> {
    if (!targetLanguage) {
      console.warn('[TranslationService] No target language provided, skipping translation');
      return text;
    }

    if (sourceLanguage === targetLanguage) {
      return text;
    }

    // Check cache first using the correct method name
    const cached = await translationCache.getTranslation(text, targetLanguage);
    if (cached) {
      console.log(`[TranslationService] Cache hit for: ${text}`);
      return cached.translatedText;
    }

    console.log('[TranslationService] Using Supabase edge function for translation');
    
    try {
      // Use Supabase edge function instead of direct API calls
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          text,
          sourceLanguage,
          targetLanguage,
          cleanResult: true
        }
      });

      if (error) {
        console.error('[TranslationService] Edge function error:', error);
        return text;
      }

      if (data && data.translatedText) {
        const translatedText = data.translatedText;
        
        // Cache the result using the correct method name
        await translationCache.setTranslation({
          originalText: text,
          translatedText,
          language: targetLanguage,
          timestamp: Date.now(),
          version: 1
        });
        
        console.log(`[TranslationService] Translated: "${text}" -> "${translatedText}"`);
        return translatedText;
      }

      return text;
    } catch (error) {
      console.error('[TranslationService] Translation error:', error);
      return text; // Return original text on error
    }
  }

  // NEW: Enhanced batch translate with atomic completion tracking
  async batchTranslate(options: { texts: string[], targetLanguage: string, sourceLanguage?: string }): Promise<Map<string, string>> {
    const { texts, targetLanguage, sourceLanguage = 'auto' } = options;
    const batchKey = `${texts.join('|')}-${sourceLanguage}-${targetLanguage}`;
    
    // Check if this exact batch is already being processed
    const existingBatch = this.batchOperations.get(batchKey);
    if (existingBatch) {
      console.log('[TranslationService] APP-LEVEL: Reusing existing batch operation');
      return existingBatch;
    }

    // Create new batch operation
    const batchPromise = this.performBatchTranslation(texts, sourceLanguage, targetLanguage);
    this.batchOperations.set(batchKey, batchPromise);

    try {
      const result = await batchPromise;
      return result;
    } finally {
      // Clean up completed batch operation
      this.batchOperations.delete(batchKey);
    }
  }

  private async performBatchTranslation(texts: string[], sourceLanguage: string, targetLanguage: string): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    if (sourceLanguage === targetLanguage) {
      texts.forEach(text => results.set(text, text));
      return results;
    }

    console.log(`[TranslationService] APP-LEVEL: Starting atomic batch translation for ${texts.length} texts`);

    // Check cache for all texts first using correct method names
    const uncachedTexts: string[] = [];
    const cacheHits = new Map<string, string>();
    
    for (const text of texts) {
      const cached = await translationCache.getTranslation(text, targetLanguage);
      if (cached) {
        cacheHits.set(text, cached.translatedText);
      } else {
        uncachedTexts.push(text);
      }
    }

    console.log(`[TranslationService] APP-LEVEL: Cache hits: ${cacheHits.size}, need translation: ${uncachedTexts.length}`);

    // Add cache hits to results
    cacheHits.forEach((translated, original) => {
      results.set(original, translated);
    });

    // Use Supabase edge function for batch translation
    if (uncachedTexts.length > 0) {
      try {
        const { data, error } = await supabase.functions.invoke('translate-text', {
          body: {
            texts: uncachedTexts,
            sourceLanguage,
            targetLanguage,
            cleanResult: true
          }
        });

        if (error) {
          console.error('[TranslationService] APP-LEVEL: Batch translation error:', error);
          // Use original texts for failed batch
          uncachedTexts.forEach(text => results.set(text, text));
        } else if (data && data.translatedTexts) {
          const translations = data.translatedTexts;
          
          for (let i = 0; i < uncachedTexts.length; i++) {
            const originalText = uncachedTexts[i];
            const translatedText = translations[i] || originalText;
            results.set(originalText, translatedText);
            
            // Cache individual results using correct method name
            await translationCache.setTranslation({
              originalText,
              translatedText,
              language: targetLanguage,
              timestamp: Date.now(),
              version: 1
            });
          }

          console.log(`[TranslationService] APP-LEVEL: Batch translation complete: ${translations.length} texts translated`);
        }
      } catch (error) {
        console.error(`[TranslationService] APP-LEVEL: Error in batch translation:`, error);
        // Use original texts for failed batch
        uncachedTexts.forEach(text => results.set(text, text));
      }
    }

    console.log(`[TranslationService] APP-LEVEL: Atomic batch translation complete: ${results.size}/${texts.length} texts processed`);
    return results;
  }

  async getCachedTranslation(text: string, sourceLanguage: string = 'auto', targetLanguage?: string): Promise<string | null> {
    if (!targetLanguage || sourceLanguage === targetLanguage) {
      return text;
    }

    const cached = await translationCache.getTranslation(text, targetLanguage);
    return cached ? cached.translatedText : null;
  }
}

export const translationService = new TranslationService();
