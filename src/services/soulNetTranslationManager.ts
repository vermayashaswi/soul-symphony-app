
import { translationService } from '@/services/translationService';
import { onDemandTranslationCache } from '@/utils/website-translations';

interface TranslationJob {
  nodeId: string;
  originalText: string;
  targetLanguage: string;
  retryCount: number;
  maxRetries: number;
}

interface TranslationResult {
  nodeId: string;
  translatedText: string;
  success: boolean;
}

export class SoulNetTranslationManager {
  private static readonly MAX_RETRIES = 3;
  private static readonly BATCH_SIZE = 50;
  private static activeJobs = new Map<string, Promise<TranslationResult>>();
  private static completedTranslations = new Map<string, string>();

  static async translateSoulNetNodes(
    nodeIds: string[],
    targetLanguage: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Map<string, string>> {
    console.log(`[SoulNetTranslationManager] Starting translation of ${nodeIds.length} nodes to ${targetLanguage}`);
    
    if (targetLanguage === 'en') {
      const results = new Map<string, string>();
      nodeIds.forEach(nodeId => results.set(nodeId, nodeId));
      return results;
    }

    // Check cache first
    const translations = new Map<string, string>();
    const needsTranslation: string[] = [];

    nodeIds.forEach(nodeId => {
      const cacheKey = `${nodeId}_${targetLanguage}`;
      const cached = onDemandTranslationCache.get(targetLanguage, nodeId);
      
      if (cached) {
        translations.set(nodeId, cached);
        this.completedTranslations.set(cacheKey, cached);
      } else {
        needsTranslation.push(nodeId);
      }
    });

    console.log(`[SoulNetTranslationManager] Found ${translations.size} cached, need to translate ${needsTranslation.length}`);

    if (needsTranslation.length === 0) {
      onProgress?.(nodeIds.length, nodeIds.length);
      return translations;
    }

    // Process in batches with retry logic
    const jobs: TranslationJob[] = needsTranslation.map(nodeId => ({
      nodeId,
      originalText: nodeId,
      targetLanguage,
      retryCount: 0,
      maxRetries: this.MAX_RETRIES
    }));

    let completed = translations.size;
    const total = nodeIds.length;

    for (let i = 0; i < jobs.length; i += this.BATCH_SIZE) {
      const batch = jobs.slice(i, i + this.BATCH_SIZE);
      const batchResults = await this.processBatchWithRetry(batch);
      
      batchResults.forEach(result => {
        if (result.success) {
          translations.set(result.nodeId, result.translatedText);
          const cacheKey = `${result.nodeId}_${targetLanguage}`;
          this.completedTranslations.set(cacheKey, result.translatedText);
          onDemandTranslationCache.set(targetLanguage, result.nodeId, result.translatedText);
        } else {
          // Fallback to original text
          translations.set(result.nodeId, result.nodeId);
          console.warn(`[SoulNetTranslationManager] Failed to translate "${result.nodeId}", using original`);
        }
        completed++;
        onProgress?.(completed, total);
      });
    }

    console.log(`[SoulNetTranslationManager] Translation complete: ${translations.size}/${nodeIds.length} successful`);
    return translations;
  }

  private static async processBatchWithRetry(jobs: TranslationJob[]): Promise<TranslationResult[]> {
    const results: TranslationResult[] = [];
    
    try {
      const batchTexts = jobs.map(job => job.originalText);
      const batchResults = await translationService.batchTranslate({
        texts: batchTexts,
        targetLanguage: jobs[0].targetLanguage
      });

      jobs.forEach(job => {
        const translatedText = batchResults.get(job.originalText);
        if (translatedText && translatedText !== job.originalText) {
          results.push({
            nodeId: job.nodeId,
            translatedText,
            success: true
          });
        } else {
          results.push({
            nodeId: job.nodeId,
            translatedText: job.originalText,
            success: false
          });
        }
      });
    } catch (error) {
      console.error('[SoulNetTranslationManager] Batch translation failed:', error);
      
      // Retry individual translations for failed batch
      for (const job of jobs) {
        if (job.retryCount < job.maxRetries) {
          try {
            const translatedText = await translationService.translateText(
              job.originalText,
              job.targetLanguage
            );
            
            results.push({
              nodeId: job.nodeId,
              translatedText: translatedText || job.originalText,
              success: !!translatedText && translatedText !== job.originalText
            });
          } catch (retryError) {
            console.error(`[SoulNetTranslationManager] Individual retry failed for "${job.originalText}":`, retryError);
            results.push({
              nodeId: job.nodeId,
              translatedText: job.originalText,
              success: false
            });
          }
        } else {
          results.push({
            nodeId: job.nodeId,
            translatedText: job.originalText,
            success: false
          });
        }
      }
    }

    return results;
  }

  static getCompletedTranslation(nodeId: string, targetLanguage: string): string | null {
    const cacheKey = `${nodeId}_${targetLanguage}`;
    return this.completedTranslations.get(cacheKey) || null;
  }

  static clearCache(): void {
    this.completedTranslations.clear();
    this.activeJobs.clear();
  }
}
