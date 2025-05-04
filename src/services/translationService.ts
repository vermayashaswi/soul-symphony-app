
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
  private static readonly BATCH_SIZE = 30; // Reduced from 50 to avoid rate limits
  private static readonly MAX_RETRIES = 5; // Increased from 3 to be more persistent
  private static readonly RETRY_DELAY = 1000; // Base delay in ms for retries (will be multiplied by 2^retryCount)
  
  static async translateText(request: TranslationRequest): Promise<string> {
    try {
      // Skip empty or whitespace-only strings
      if (!request.text || request.text.trim() === '') {
        return request.text;
      }
      
      // Check cache first
      const cached = await translationCache.getTranslation(request.text, request.targetLanguage);
      if (cached) {
        console.log(`Cache hit for "${request.text.substring(0, 20)}..." in ${request.targetLanguage}`);
        return cached.translatedText;
      }

      // Implement retry logic for the API call
      let retryCount = 0;
      let lastError: any = null;

      while (retryCount < this.MAX_RETRIES) {
        try {
          console.log(`Translation attempt ${retryCount + 1} for "${request.text.substring(0, 20)}..."`);
          
          // Call the edge function for translation
          const { data, error } = await supabase.functions.invoke('translate-text', {
            body: {
              text: request.text,
              sourceLanguage: request.sourceLanguage,
              targetLanguage: request.targetLanguage,
              entryId: request.entryId
            },
          });

          if (error) {
            console.error(`Translation error (attempt ${retryCount + 1}):`, error);
            lastError = error;
            // Throw to trigger retry
            throw error;
          }

          if (!data || !data.translatedText) {
            console.error(`Translation response missing translatedText (attempt ${retryCount + 1}):`, data);
            lastError = new Error('Missing translated text in response');
            // Throw to trigger retry
            throw lastError;
          }

          // Success! Cache the translation
          await translationCache.setTranslation({
            originalText: request.text,
            translatedText: data.translatedText,
            language: request.targetLanguage,
            timestamp: Date.now(),
            version: 2, // Increment version to easily identify new translations
          });

          console.log(`Successful translation to ${request.targetLanguage} after ${retryCount + 1} attempts`);
          
          // Dispatch an event that translation succeeded
          window.dispatchEvent(new CustomEvent('translationSuccess', { 
            detail: { 
              text: request.text.substring(0, 20),
              language: request.targetLanguage
            }
          }));
          
          return data.translatedText;
        } catch (error) {
          lastError = error;
          retryCount++;
          
          if (retryCount < this.MAX_RETRIES) {
            // Exponential backoff delay
            const delay = this.RETRY_DELAY * Math.pow(2, retryCount - 1);
            console.log(`Retrying translation in ${delay}ms (attempt ${retryCount + 1} of ${this.MAX_RETRIES})...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // All retries failed
      console.error(`All ${this.MAX_RETRIES} translation attempts failed:`, lastError);
      toast.error(`Translation failed after multiple attempts. Using original text.`);
      
      // Dispatch an event that translation failed
      window.dispatchEvent(new CustomEvent('translationFailure', { 
        detail: { 
          text: request.text.substring(0, 20),
          language: request.targetLanguage,
          error: lastError?.message || 'Unknown error'
        }
      }));
      
      return request.text;
    } catch (error) {
      console.error('Translation service error:', error);
      toast.error('Translation service error. Using original text.');
      return request.text;
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

    // Check cache first for all texts
    for (const text of validTexts) {
      const cached = await translationCache.getTranslation(text, request.targetLanguage);
      if (cached) {
        results.set(text, cached.translatedText);
      } else {
        needsTranslation.push(text);
      }
    }
    
    console.log(`BatchTranslate: ${validTexts.length} texts, ${results.size} from cache, ${needsTranslation.length} need translation`);

    // Use smaller batch size for more reliable API performance
    const smallerBatchSize = Math.min(this.BATCH_SIZE, 20); // Reduced batch size for better reliability
    
    // Split remaining texts into smaller batches
    for (let i = 0; i < needsTranslation.length; i += smallerBatchSize) {
      const batch = needsTranslation.slice(i, i + smallerBatchSize);
      console.log(`Processing batch ${Math.floor(i/smallerBatchSize) + 1} of ${Math.ceil(needsTranslation.length/smallerBatchSize)}: ${batch.length} texts`);
      
      // Implement retry logic for each batch
      let batchSuccess = false;
      let retryCount = 0;
      
      while (!batchSuccess && retryCount < this.MAX_RETRIES) {
        try {
          console.log(`Batch translation attempt ${retryCount + 1} for ${batch.length} texts`);
          
          const { data, error } = await supabase.functions.invoke('translate-text', {
            body: {
              texts: batch,
              targetLanguage: request.targetLanguage,
            },
          });

          if (error) {
            console.error(`Batch translation error (attempt ${retryCount + 1}):`, error);
            retryCount++;
            
            if (retryCount < this.MAX_RETRIES) {
              // Exponential backoff delay
              const delay = this.RETRY_DELAY * Math.pow(2, retryCount - 1);
              console.log(`Retrying batch translation in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            } else {
              console.error(`All batch translation attempts failed for ${batch.length} texts`);
              throw error;
            }
          }

          if (data && data.translatedTexts && Array.isArray(data.translatedTexts)) {
            // Cache and store results
            batch.forEach((text, index) => {
              const translatedText = data.translatedTexts[index];
              if (translatedText) {
                results.set(text, translatedText);
                translationCache.setTranslation({
                  originalText: text,
                  translatedText,
                  language: request.targetLanguage,
                  timestamp: Date.now(),
                  version: 2,
                });
              } else {
                // If a specific translation failed, fall back to original
                console.warn(`Missing translation for text: "${text.substring(0, 20)}..."`);
                results.set(text, text);
              }
            });
            
            batchSuccess = true;
            console.log(`Successfully translated ${batch.length} texts in batch`);
          } else {
            console.error('Invalid response format for batch translation:', data);
            retryCount++;
            
            if (retryCount < this.MAX_RETRIES) {
              // Exponential backoff delay
              const delay = this.RETRY_DELAY * Math.pow(2, retryCount - 1);
              console.log(`Retrying batch translation in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              batch.forEach(text => results.set(text, text)); // Fallback to original text
            }
          }
        } catch (error) {
          console.error('Batch translation error:', error);
          retryCount++;
          
          if (retryCount < this.MAX_RETRIES) {
            // Exponential backoff delay
            const delay = this.RETRY_DELAY * Math.pow(2, retryCount - 1);
            console.log(`Retrying batch translation in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            // All retries failed, fall back to original text
            batch.forEach(text => results.set(text, text));
          }
        }
      }
    }

    return results;
  }
}
