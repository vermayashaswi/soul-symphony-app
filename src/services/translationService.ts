
import { translationCache } from './translationCache';

class TranslationService {
  private apiKey: string | null = null;
  private baseURL = 'https://translation.googleapis.com/language/translate/v2';
  
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

    if (!this.hasApiKey()) {
      console.warn('[TranslationService] No API key set, returning original text');
      return text;
    }

    try {
      const response = await fetch(`${this.baseURL}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          source: sourceLanguage,
          target: targetLanguage,
          format: 'text'
        }),
      });

      if (!response.ok) {
        throw new Error(`Translation API error: ${response.status}`);
      }

      const data = await response.json();
      const translatedText = data.data.translations[0].translatedText;
      
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

    // If no API key, return original texts for uncached items
    if (!this.hasApiKey()) {
      console.warn('[TranslationService] APP-LEVEL: No API key, using original texts for uncached items');
      uncachedTexts.forEach(text => results.set(text, text));
      return results;
    }

    // Translate uncached texts in smaller batches to respect API limits
    const batchSize = 10; // Google Translate API batch limit
    
    for (let i = 0; i < uncachedTexts.length; i += batchSize) {
      const batch = uncachedTexts.slice(i, i + batchSize);
      
      try {
        const response = await fetch(`${this.baseURL}?key=${this.apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: batch,
            source: sourceLanguage,
            target: targetLanguage,
            format: 'text'
          }),
        });

        if (!response.ok) {
          throw new Error(`Translation API error: ${response.status}`);
        }

        const data = await response.json();
        const translations = data.data.translations;
        
        for (let j = 0; j < batch.length; j++) {
          const originalText = batch[j];
          const translatedText = translations[j]?.translatedText || originalText;
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

        console.log(`[TranslationService] APP-LEVEL: Translated batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(uncachedTexts.length / batchSize)}`);
        
      } catch (error) {
        console.error(`[TranslationService] APP-LEVEL: Error translating batch starting at ${i}:`, error);
        // Use original texts for failed batch
        batch.forEach(text => results.set(text, text));
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
