
import { translationCache } from './translationCache';
import { supabase } from '@/integrations/supabase/client';

class TranslationService {
  private apiKey: string | null = null;
  
  // NEW: Batch operation tracking
  private batchOperations = new Map<string, Promise<Map<string, string>>>();

  // NEW: Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  async setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  private hasApiKey(): boolean {
    return !!this.apiKey;
  }

  // NEW: Helper method for exponential backoff delay
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async translate(text: string, sourceLanguage: string = 'en', targetLanguage?: string): Promise<string | null> {
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
          sourceLanguage: sourceLanguage === 'auto' ? 'en' : sourceLanguage,
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

  // ENHANCED: Robust batch translate with retry logic and individual fallback
  async batchTranslate(options: { texts: string[], targetLanguage: string, sourceLanguage?: string }): Promise<Map<string, string>> {
    const { texts, targetLanguage, sourceLanguage = 'en' } = options;
    const batchKey = `${texts.join('|')}-${sourceLanguage}-${targetLanguage}`;
    
    // Check if this exact batch is already being processed
    const existingBatch = this.batchOperations.get(batchKey);
    if (existingBatch) {
      console.log('[TranslationService] ENHANCED: Reusing existing batch operation');
      return existingBatch;
    }

    // Create new batch operation
    const batchPromise = this.performEnhancedBatchTranslation(texts, sourceLanguage, targetLanguage);
    this.batchOperations.set(batchKey, batchPromise);

    try {
      const result = await batchPromise;
      return result;
    } finally {
      // Clean up completed batch operation
      this.batchOperations.delete(batchKey);
    }
  }

  private async performEnhancedBatchTranslation(texts: string[], sourceLanguage: string, targetLanguage: string): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    if (sourceLanguage === targetLanguage) {
      texts.forEach(text => results.set(text, text));
      return results;
    }

    console.log(`[TranslationService] ENHANCED: Starting robust batch translation for ${texts.length} texts`);

    // Check cache for all texts first
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

    console.log(`[TranslationService] ENHANCED: Cache hits: ${cacheHits.size}, need translation: ${uncachedTexts.length}`);

    // Add cache hits to results
    cacheHits.forEach((translated, original) => {
      results.set(original, translated);
    });

    // NEW: Enhanced batch translation with retry logic
    if (uncachedTexts.length > 0) {
      const batchResults = await this.performBatchTranslationWithRetry(uncachedTexts, sourceLanguage, targetLanguage);
      
      // Add batch results to final results
      batchResults.forEach((translated, original) => {
        results.set(original, translated);
      });
    }

    // NEW: Verification step - ensure all requested texts have translations
    const missingTranslations = texts.filter(text => !results.has(text));
    if (missingTranslations.length > 0) {
      console.warn(`[TranslationService] ENHANCED: ${missingTranslations.length} texts still missing translations, using original text`);
      missingTranslations.forEach(text => {
        results.set(text, text);
      });
    }

    console.log(`[TranslationService] ENHANCED: Batch translation complete: ${results.size}/${texts.length} texts processed`);
    return results;
  }

  // NEW: Batch translation with retry and individual fallback
  private async performBatchTranslationWithRetry(
    texts: string[], 
    sourceLanguage: string, 
    targetLanguage: string
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    let remainingTexts = [...texts];
    
    // Try batch translation with retries
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      if (remainingTexts.length === 0) break;
      
      console.log(`[TranslationService] ENHANCED: Batch attempt ${attempt}/${this.MAX_RETRIES} for ${remainingTexts.length} texts`);
      
      try {
        const { data, error } = await supabase.functions.invoke('translate-text', {
          body: {
            texts: remainingTexts,
            sourceLanguage: sourceLanguage === 'auto' ? 'en' : sourceLanguage,
            targetLanguage,
            cleanResult: true
          }
        });

        if (!error && data && data.translatedTexts && Array.isArray(data.translatedTexts)) {
          const translations = data.translatedTexts;
          const successfulTranslations: string[] = [];
          
          // Process successful translations
          for (let i = 0; i < Math.min(remainingTexts.length, translations.length); i++) {
            const originalText = remainingTexts[i];
            const translatedText = translations[i];
            
            if (translatedText && translatedText.trim() && translatedText !== originalText) {
              results.set(originalText, translatedText);
              successfulTranslations.push(originalText);
              
              // Cache individual results
              await translationCache.setTranslation({
                originalText,
                translatedText,
                language: targetLanguage,
                timestamp: Date.now(),
                version: 1
              });
            }
          }
          
          // Remove successfully translated texts from remaining list
          remainingTexts = remainingTexts.filter(text => !successfulTranslations.includes(text));
          
          console.log(`[TranslationService] ENHANCED: Batch attempt ${attempt} successful: ${successfulTranslations.length}/${texts.length}, remaining: ${remainingTexts.length}`);
          
          // If we got all translations, we're done
          if (remainingTexts.length === 0) {
            break;
          }
        } else {
          console.error(`[TranslationService] ENHANCED: Batch attempt ${attempt} failed:`, error);
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < this.MAX_RETRIES && remainingTexts.length > 0) {
          await this.delay(this.RETRY_DELAY * Math.pow(2, attempt - 1));
        }
      } catch (error) {
        console.error(`[TranslationService] ENHANCED: Batch attempt ${attempt} exception:`, error);
        
        // Wait before retry
        if (attempt < this.MAX_RETRIES && remainingTexts.length > 0) {
          await this.delay(this.RETRY_DELAY * Math.pow(2, attempt - 1));
        }
      }
    }
    
    // NEW: Individual translation fallback for remaining texts
    if (remainingTexts.length > 0) {
      console.log(`[TranslationService] ENHANCED: Falling back to individual translation for ${remainingTexts.length} texts`);
      
      const individualPromises = remainingTexts.map(async (text) => {
        try {
          const translated = await this.translate(text, sourceLanguage, targetLanguage);
          if (translated && translated !== text) {
            results.set(text, translated);
            return { text, success: true };
          } else {
            results.set(text, text); // Use original if translation fails
            return { text, success: false };
          }
        } catch (error) {
          console.error(`[TranslationService] ENHANCED: Individual translation failed for "${text}":`, error);
          results.set(text, text); // Use original on error
          return { text, success: false };
        }
      });
      
      const individualResults = await Promise.all(individualPromises);
      const individualSuccesses = individualResults.filter(r => r.success).length;
      
      console.log(`[TranslationService] ENHANCED: Individual fallback complete: ${individualSuccesses}/${remainingTexts.length} successful`);
    }
    
    return results;
  }

  async getCachedTranslation(text: string, sourceLanguage: string = 'en', targetLanguage?: string): Promise<string | null> {
    if (!targetLanguage || sourceLanguage === targetLanguage) {
      return text;
    }

    const cached = await translationCache.getTranslation(text, targetLanguage);
    return cached ? cached.translatedText : null;
  }
}

export const translationService = new TranslationService();
