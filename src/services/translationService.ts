
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

  // ENHANCED: Fixed batch translate with proper source language handling
  async batchTranslate(texts: string[], sourceLanguage: string = 'en', targetLanguage?: string): Promise<Map<string, string>> {
    if (!targetLanguage || sourceLanguage === targetLanguage) {
      const resultMap = new Map<string, string>();
      texts.forEach(text => resultMap.set(text, text));
      return resultMap;
    }

    const batchKey = `${targetLanguage}-${texts.join('|')}`;
    
    // Check if this batch is already being processed
    if (this.batchOperations.has(batchKey)) {
      console.log('[TranslationService] Batch operation already in progress, waiting...');
      return await this.batchOperations.get(batchKey)!;
    }

    const batchPromise = this.performBatchTranslation(texts, sourceLanguage, targetLanguage);
    this.batchOperations.set(batchKey, batchPromise);

    try {
      const result = await batchPromise;
      return result;
    } finally {
      this.batchOperations.delete(batchKey);
    }
  }

  private async performBatchTranslation(texts: string[], sourceLanguage: string, targetLanguage: string): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const textsToTranslate: string[] = [];

    // Check cache for each text
    for (const text of texts) {
      const cached = await translationCache.getTranslation(text, targetLanguage);
      if (cached) {
        results.set(text, cached.translatedText);
        console.log(`[TranslationService] Batch cache hit for: ${text}`);
      } else {
        textsToTranslate.push(text);
      }
    }

    // If all texts are cached, return early
    if (textsToTranslate.length === 0) {
      console.log('[TranslationService] All texts found in cache for batch translation');
      return results;
    }

    console.log(`[TranslationService] Batch translating ${textsToTranslate.length} texts from ${sourceLanguage} to ${targetLanguage}`);

    try {
      // Use Supabase edge function for batch translation
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          texts: textsToTranslate,
          sourceLanguage: sourceLanguage === 'auto' ? 'en' : sourceLanguage,
          targetLanguage,
          cleanResult: true
        }
      });

      if (error) {
        console.error('[TranslationService] Batch translation edge function error:', error);
        // Fallback: add original texts to results
        textsToTranslate.forEach(text => results.set(text, text));
        return results;
      }

      if (data && data.translatedTexts && Array.isArray(data.translatedTexts)) {
        // Process batch results
        for (let i = 0; i < textsToTranslate.length; i++) {
          const originalText = textsToTranslate[i];
          const translatedText = data.translatedTexts[i] || originalText;
          
          results.set(originalText, translatedText);
          
          // Cache each result
          await translationCache.setTranslation({
            originalText,
            translatedText,
            language: targetLanguage,
            timestamp: Date.now(),
            version: 1
          });
        }
        
        console.log(`[TranslationService] Batch translation successful: ${textsToTranslate.length} texts processed`);
      } else {
        console.warn('[TranslationService] Invalid batch translation response format');
        textsToTranslate.forEach(text => results.set(text, text));
      }
    } catch (error) {
      console.error('[TranslationService] Batch translation error:', error);
      textsToTranslate.forEach(text => results.set(text, text));
    }

    return results;
  }

  // ENHANCED: Coordinated cache access for consistency
  async getCachedTranslation(text: string, targetLanguage: string): Promise<string | null> {
    const cached = await translationCache.getTranslation(text, targetLanguage);
    return cached ? cached.translatedText : null;
  }

  // Clear translations for a specific language
  async clearLanguageCache(language: string): Promise<void> {
    console.log(`[TranslationService] Clearing cache for language: ${language}`);
    await translationCache.clearCache(language);
  }

  // Get all cached translations for debugging
  async getAllCachedTranslations(): Promise<any[]> {
    return await translationCache.getAllTranslations();
  }
}

export const translationService = new TranslationService();
