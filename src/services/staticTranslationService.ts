
import { TranslationService } from './translationService';

export class StaticTranslationService {
  private language: string = 'en';
  private translationInProgress: boolean = false;
  private batchTranslationQueue: Map<string, (result: string) => void> = new Map();
  private batchTranslationTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 100; // ms to wait before sending batch
  private translationFailures: Set<string> = new Set(); // Track failed translations
  private retryTimer: NodeJS.Timeout | null = null;

  setLanguage(language: string): void {
    this.language = language;
    console.log(`StaticTranslationService: Language set to ${language}`);
    
    // Clear failed translations on language change to allow retries
    this.translationFailures.clear();
  }

  async translateText(text: string, sourceLanguage?: string, entryId?: number): Promise<string> {
    // Skip translation for English, empty text, or null text
    if (this.language === 'en' || !text || text.trim() === '') {
      return text || '';
    }

    // Skip if we've already failed to translate this recently
    const cacheKey = `${text.substring(0, 50)}_${this.language}`;
    if (this.translationFailures.has(cacheKey)) {
      console.log(`StaticTranslationService: Skipping previously failed translation: "${text.substring(0, 30)}..."`);
      return text;
    }

    try {
      console.log(`StaticTranslationService: Translating text to ${this.language}: "${text.substring(0, 30)}..."`);
      const result = await TranslationService.translateText({
        text,
        sourceLanguage: sourceLanguage || 'en',
        targetLanguage: this.language,
        entryId,
      });

      // If translation returned same as input for non-English target, it may have failed
      if (result === text && this.language !== 'en') {
        // Don't add to failures if it's a very short text that might legitimately be the same
        if (text.length > 3) {
          console.warn(`StaticTranslationService: Translation may have failed - same output as input: "${text}"`);
          this.translationFailures.add(cacheKey);
          this.scheduleRetryFailedTranslations();
        }
      }

      return result;
    } catch (error) {
      console.error('StaticTranslationService: Error translating text:', error);
      this.translationFailures.add(cacheKey);
      this.scheduleRetryFailedTranslations();
      return text;
    }
  }

  // Schedule a retry for all failed translations
  private scheduleRetryFailedTranslations(): void {
    if (this.retryTimer) return; // Already scheduled
    
    this.retryTimer = setTimeout(() => {
      this.retryFailedTranslations();
    }, 60000); // Retry after 1 minute
  }

  // Retry all failed translations
  private async retryFailedTranslations(): Promise<void> {
    this.retryTimer = null;
    
    if (this.translationFailures.size === 0 || this.language === 'en') return;
    
    console.log(`StaticTranslationService: Retrying ${this.translationFailures.size} failed translations`);
    
    // Take only 10 failed translations at a time to avoid overwhelming the API
    const failuresToRetry = Array.from(this.translationFailures).slice(0, 10);
    
    // Clear the ones we're going to retry
    failuresToRetry.forEach(key => this.translationFailures.delete(key));
    
    // If there are still more failures, schedule another retry
    if (this.translationFailures.size > 0) {
      this.scheduleRetryFailedTranslations();
    }
    
    // Extract the actual text from the cache keys
    const textsToRetry = failuresToRetry.map(key => key.split('_')[0]);
    
    try {
      // Batch translate them
      await this.batchTranslateTexts(textsToRetry);
      console.log(`StaticTranslationService: Successfully retried ${textsToRetry.length} translations`);
      
      // Dispatch event to notify components that translations have been updated
      window.dispatchEvent(new CustomEvent('translationsUpdated', {
        detail: {
          count: textsToRetry.length,
          language: this.language
        }
      }));
    } catch (error) {
      console.error('StaticTranslationService: Failed to retry translations:', error);
      
      // Put them back in the failure set
      failuresToRetry.forEach(key => this.translationFailures.add(key));
      
      // Always ensure we schedule another retry
      this.scheduleRetryFailedTranslations();
    }
  }

  async preTranslate(texts: string[]): Promise<Map<string, string>> {
    if (this.language === 'en') {
      // For English, just return originals
      const results = new Map<string, string>();
      texts.forEach(text => {
        if (text) results.set(text, text);
      });
      return results;
    }

    try {
      // Filter out empty or null texts
      const validTexts = texts.filter(text => text && text.trim() !== '');
      
      if (validTexts.length === 0) {
        console.log('StaticTranslationService: No valid texts to pre-translate');
        return new Map<string, string>();
      }
      
      console.log(`StaticTranslationService: Pre-translating ${validTexts.length} texts to ${this.language}`);
      return await TranslationService.batchTranslate({
        texts: validTexts,
        targetLanguage: this.language,
      });
    } catch (error) {
      console.error('StaticTranslationService: Error batch translating texts:', error);
      // Return original texts as fallback
      const results = new Map<string, string>();
      texts.forEach(text => {
        if (text) results.set(text, text);
      });
      return results;
    }
  }

  async batchTranslateTexts(texts: string[]): Promise<Map<string, string>> {
    if (this.language === 'en') {
      // For English, just return originals
      const results = new Map<string, string>();
      texts.forEach(text => {
        if (text) results.set(text, text);
      });
      return results;
    }

    // Extra safety checks for empty arrays
    if (!texts || texts.length === 0) {
      console.log('StaticTranslationService: Empty input array for batch translation');
      return new Map<string, string>();
    }

    try {
      // Filter out empty texts
      const validTexts = texts.filter(text => text && text.trim() !== '');
      
      // If no valid texts, return empty map
      if (validTexts.length === 0) {
        console.log('StaticTranslationService: No valid texts to batch translate');
        return new Map<string, string>();
      }
      
      console.log(`StaticTranslationService: Batch translating ${validTexts.length} texts to ${this.language}`);
      
      // Add retry logic with max 3 attempts
      let attempts = 0;
      const maxAttempts = 3;
      let translationResults: Map<string, string> | null = null;
      
      while (attempts < maxAttempts && !translationResults) {
        try {
          console.log(`StaticTranslationService: Translation attempt ${attempts + 1} of ${maxAttempts}`);
          translationResults = await TranslationService.batchTranslate({
            texts: validTexts,
            targetLanguage: this.language,
          });
          
          // Validate results
          if (translationResults && translationResults.size > 0) {
            console.log(`StaticTranslationService: Successfully translated ${translationResults.size} texts`);
          } else {
            console.warn('StaticTranslationService: Empty translation results received');
            translationResults = null; // Force retry
            throw new Error('Empty translation results');
          }
        } catch (error) {
          attempts++;
          console.warn(`StaticTranslationService: Translation attempt ${attempts} failed:`, error);
          
          if (attempts >= maxAttempts) {
            console.error('StaticTranslationService: All translation attempts failed');
            
            // After all attempts fail, return a fallback with original texts
            const fallbackResults = new Map<string, string>();
            validTexts.forEach(text => {
              if (text) fallbackResults.set(text, text);
            });
            
            console.log('StaticTranslationService: Using fallback translations (original text)');
            return fallbackResults;
          }
          
          // Wait before retrying with exponential backoff
          const waitTime = 500 * Math.pow(2, attempts - 1);
          console.log(`StaticTranslationService: Waiting ${waitTime}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      
      if (!translationResults) {
        // This should never happen due to the fallback above, but just for safety
        console.error("StaticTranslationService: Failed to translate after multiple attempts");
        
        // Return original texts as fallback
        const fallbackResults = new Map<string, string>();
        validTexts.forEach(text => {
          if (text) fallbackResults.set(text, text);
        });
        
        return fallbackResults;
      }
      
      return translationResults;
    } catch (error) {
      console.error('StaticTranslationService: Error batch translating texts:', error);
      
      // Return original texts as fallback
      const results = new Map<string, string>();
      texts.forEach(text => {
        if (text) results.set(text, text);
      });
      
      return results;
    }
  }
  
  // Queue a text for batch translation with promise-based result
  queueForBatchTranslation(text: string): Promise<string> {
    if (this.language === 'en' || !text) {
      return Promise.resolve(text || '');
    }
    
    return new Promise((resolve) => {
      // Add to queue
      this.batchTranslationQueue.set(text, resolve);
      
      // Set/reset timer for batch processing
      if (this.batchTranslationTimer) {
        clearTimeout(this.batchTranslationTimer);
      }
      
      this.batchTranslationTimer = setTimeout(() => {
        this.processBatchQueue();
      }, this.BATCH_DELAY);
    });
  }
  
  // Process all queued translations as a batch
  private async processBatchQueue(): Promise<void> {
    if (this.batchTranslationQueue.size === 0) return;
    
    // Clear the timer
    if (this.batchTranslationTimer) {
      clearTimeout(this.batchTranslationTimer);
      this.batchTranslationTimer = null;
    }
    
    // Prevent concurrent batch processing
    if (this.translationInProgress) {
      console.log('StaticTranslationService: Another batch translation already in progress, will retry later');
      
      // Re-schedule processing for later
      this.batchTranslationTimer = setTimeout(() => {
        this.processBatchQueue();
      }, this.BATCH_DELAY);
      
      return;
    }
    
    this.translationInProgress = true;
    console.log(`StaticTranslationService: Processing batch queue with ${this.batchTranslationQueue.size} items`);
    
    try {
      // Extract texts from queue
      const textsToTranslate = Array.from(this.batchTranslationQueue.keys());
      const resolvers = Array.from(this.batchTranslationQueue.values());
      
      // Clear queue
      this.batchTranslationQueue.clear();
      
      // Translate
      const results = await this.batchTranslateTexts(textsToTranslate);
      console.log(`StaticTranslationService: Batch translation completed for ${textsToTranslate.length} items`);
      
      // Resolve promises with results
      textsToTranslate.forEach((text, index) => {
        const translatedText = results.get(text) || text;
        resolvers[index](translatedText);
      });
    } catch (error) {
      console.error('StaticTranslationService: Batch translation failed:', error);
      
      // Resolve all with original text in case of error
      Array.from(this.batchTranslationQueue.entries()).forEach(([text, resolver]) => {
        resolver(text);
      });
      
      // Clear queue
      this.batchTranslationQueue.clear();
    } finally {
      this.translationInProgress = false;
      
      // If new items were added while processing, trigger another batch
      if (this.batchTranslationQueue.size > 0) {
        console.log(`StaticTranslationService: ${this.batchTranslationQueue.size} new items were added while processing, triggering another batch`);
        this.batchTranslationTimer = setTimeout(() => {
          this.processBatchQueue();
        }, this.BATCH_DELAY);
      }
    }
  }
}

export const staticTranslationService = new StaticTranslationService();
