
import { supabase } from '@/integrations/supabase/client';
import { translationCache } from './translationCache';
import { toast } from 'sonner';

interface TranslationRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  entryId?: number; // Added entryId parameter
}

interface BatchTranslationRequest {
  texts: string[];
  targetLanguage: string;
}

export class TranslationService {
  private static readonly BATCH_SIZE = 50;
  private static readonly MAX_RETRIES = 3;
  
  static async translateText(request: TranslationRequest): Promise<string> {
    try {
      // Check cache first
      const cached = await translationCache.getTranslation(request.text, request.targetLanguage);
      if (cached) {
        return cached.translatedText;
      }

      // Call the edge function for translation
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          text: request.text,
          sourceLanguage: request.sourceLanguage,
          targetLanguage: request.targetLanguage,
          entryId: request.entryId // Pass entryId to edge function
        },
      });

      if (error) {
        console.error('Translation error:', error);
        toast.error('Translation failed. Falling back to original text.');
        return request.text;
      }

      // Cache the translation
      await translationCache.setTranslation({
        originalText: request.text,
        translatedText: data.translatedText,
        language: request.targetLanguage,
        timestamp: Date.now(),
        version: 1,
      });

      return data.translatedText;
    } catch (error) {
      console.error('Translation service error:', error);
      toast.error('Translation service error. Using original text.');
      return request.text;
    }
  }

  static async batchTranslate(request: BatchTranslationRequest): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const needsTranslation: string[] = [];

    // Check cache first for all texts
    for (const text of request.texts) {
      const cached = await translationCache.getTranslation(text, request.targetLanguage);
      if (cached) {
        results.set(text, cached.translatedText);
      } else {
        needsTranslation.push(text);
      }
    }

    // Split remaining texts into batches
    for (let i = 0; i < needsTranslation.length; i += this.BATCH_SIZE) {
      const batch = needsTranslation.slice(i, i + this.BATCH_SIZE);
      try {
        const { data, error } = await supabase.functions.invoke('translate-text', {
          body: {
            texts: batch,
            targetLanguage: request.targetLanguage,
          },
        });

        if (error) throw error;

        // Cache and store results
        batch.forEach((text, index) => {
          const translatedText = data.translatedTexts[index];
          results.set(text, translatedText);
          translationCache.setTranslation({
            originalText: text,
            translatedText,
            language: request.targetLanguage,
            timestamp: Date.now(),
            version: 1,
          });
        });
      } catch (error) {
        console.error('Batch translation error:', error);
        batch.forEach(text => results.set(text, text)); // Fallback to original text
      }
    }

    return results;
  }
}
