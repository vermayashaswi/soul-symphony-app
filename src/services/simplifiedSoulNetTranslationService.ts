import { NodeTranslationCacheService } from './nodeTranslationCache';
import { translationService } from './translationService';

export interface SimplifiedSoulNetTranslationResult {
  translations: Map<string, string>;
  isTranslating: boolean;
  progress: number;
  translationComplete: boolean;
}

export class SimplifiedSoulNetTranslationService {
  private static readonly MAX_CACHE_SIZE = 10000;
  private static readonly BATCH_SIZE = 10;
  
  // Local memory cache for faster access
  private static memoryCache = new Map<string, Map<string, string>>();
  
  // Translation states for progress tracking
  private static translationStates = new Map<string, {
    isTranslating: boolean;
    progress: number;
    complete: boolean;
    startedAt: number;
  }>();

  // ENHANCED: Comprehensive batch translation and caching for pre-translation
  static async batchTranslateAndCache(
    nodeIds: string[], 
    language: string, 
    userId: string,
    progressCallback?: (progress: number) => void
  ): Promise<Map<string, string>> {
    const stateKey = `${userId}-${language}`;
    const translations = new Map<string, string>();
    
    if (language === 'en') {
      nodeIds.forEach(nodeId => translations.set(nodeId, nodeId));
      progressCallback?.(100);
      return translations;
    }

    console.log(`[SimplifiedSoulNetTranslationService] ENHANCED: Batch translating ${nodeIds.length} nodes for ${language}`);

    try {
      // Set initial translation state
      this.setTranslationState(stateKey, { isTranslating: true, progress: 0, complete: false });

      // Check existing cache first
      const cachedTranslations = await NodeTranslationCacheService.getBatchCachedTranslations(nodeIds, language);
      cachedTranslations.forEach((translation, nodeId) => {
        translations.set(nodeId, translation);
      });

      const uncachedNodes = nodeIds.filter(nodeId => !translations.has(nodeId));
      
      if (uncachedNodes.length === 0) {
        console.log('[SimplifiedSoulNetTranslationService] ENHANCED: All nodes already cached');
        this.setTranslationState(stateKey, { isTranslating: false, progress: 100, complete: true });
        progressCallback?.(100);
        return translations;
      }

      // Report initial progress based on cached translations
      const initialProgress = Math.round((translations.size / nodeIds.length) * 100);
      this.setTranslationState(stateKey, { isTranslating: true, progress: initialProgress, complete: false });
      progressCallback?.(initialProgress);

      console.log(`[SimplifiedSoulNetTranslationService] ENHANCED: Translating ${uncachedNodes.length} uncached nodes`);

      // Translate uncached nodes in batches
      const batches = [];
      for (let i = 0; i < uncachedNodes.length; i += this.BATCH_SIZE) {
        batches.push(uncachedNodes.slice(i, i + this.BATCH_SIZE));
      }

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        try {
          const batchResults = await translationService.batchTranslate({
            texts: batch,
            targetLanguage: language,
            sourceLanguage: 'en'
          });

          const batchTranslations = new Map<string, string>();
          batch.forEach(nodeId => {
            const translatedText = batchResults.get(nodeId);
            if (translatedText && translatedText.trim()) {
              batchTranslations.set(nodeId, translatedText);
              translations.set(nodeId, translatedText);
            } else {
              batchTranslations.set(nodeId, nodeId);
              translations.set(nodeId, nodeId);
            }
          });

          // Cache this batch
          await NodeTranslationCacheService.setBatchCachedTranslations(batchTranslations, language);
          
          // Update memory cache
          this.updateMemoryCache(language, batchTranslations);
          
          // Report progress
          const currentProgress = Math.round((translations.size / nodeIds.length) * 100);
          this.setTranslationState(stateKey, { isTranslating: true, progress: currentProgress, complete: false });
          progressCallback?.(currentProgress);
          
          console.log(`[SimplifiedSoulNetTranslationService] ENHANCED: Completed batch ${i + 1}/${batches.length}, progress: ${currentProgress}%`);
          
        } catch (batchError) {
          console.error(`[SimplifiedSoulNetTranslationService] ENHANCED: Error translating batch ${i + 1}:`, batchError);
          
          // Set fallback translations for failed batch
          batch.forEach(nodeId => {
            if (!translations.has(nodeId)) {
              translations.set(nodeId, nodeId);
            }
          });
        }
      }

      // Mark translation as complete
      this.setTranslationState(stateKey, { isTranslating: false, progress: 100, complete: true });
      progressCallback?.(100);
      
      console.log(`[SimplifiedSoulNetTranslationService] ENHANCED: Batch translation completed for ${language}, ${translations.size} total translations`);
      
      // Emit completion event
      window.dispatchEvent(new CustomEvent('soulNetTranslationComplete', {
        detail: { language, nodeCount: nodeIds.length, stateKey }
      }));
      
      return translations;
      
    } catch (error) {
      console.error('[SimplifiedSoulNetTranslationService] ENHANCED: Error in batch translation:', error);
      
      // Set error state and fallback translations
      this.setTranslationState(stateKey, { isTranslating: false, progress: 100, complete: false });
      
      nodeIds.forEach(nodeId => {
        if (!translations.has(nodeId)) {
          translations.set(nodeId, nodeId);
        }
      });
      
      progressCallback?.(100);
      return translations;
    }
  }

  // ENHANCED: Get translations for language with comprehensive caching
  static async getTranslationsForLanguage(
    nodeIds: string[], 
    language: string, 
    userId: string
  ): Promise<SimplifiedSoulNetTranslationResult> {
    const stateKey = `${userId}-${language}`;
    
    if (language === 'en') {
      const englishTranslations = new Map<string, string>();
      nodeIds.forEach(nodeId => englishTranslations.set(nodeId, nodeId));
      return {
        translations: englishTranslations,
        isTranslating: false,
        progress: 100,
        translationComplete: true
      };
    }

    console.log(`[SimplifiedSoulNetTranslationService] ENHANCED: Getting translations for ${nodeIds.length} nodes in ${language}`);

    try {
      const translations = new Map<string, string>();
      
      // Check memory cache first
      const memoryTranslations = this.getFromMemoryCache(language, nodeIds);
      memoryTranslations.forEach((translation, nodeId) => {
        translations.set(nodeId, translation);
      });
      
      // Check database cache for remaining nodes
      const uncachedNodes = nodeIds.filter(nodeId => !translations.has(nodeId));
      if (uncachedNodes.length > 0) {
        const dbTranslations = await NodeTranslationCacheService.getBatchCachedTranslations(uncachedNodes, language);
        dbTranslations.forEach((translation, nodeId) => {
          translations.set(nodeId, translation);
        });
        
        // Update memory cache with DB results
        this.updateMemoryCache(language, dbTranslations);
      }

      const currentProgress = Math.round((translations.size / nodeIds.length) * 100);
      const stillUncachedNodes = nodeIds.filter(nodeId => !translations.has(nodeId));
      
      // Get current translation state
      const currentState = this.getTranslationState(stateKey);
      
      console.log(`[SimplifiedSoulNetTranslationService] ENHANCED: Found ${translations.size}/${nodeIds.length} translations (${currentProgress}%), ${stillUncachedNodes.length} still needed`);
      
      return {
        translations,
        isTranslating: currentState.isTranslating && stillUncachedNodes.length > 0,
        progress: currentProgress,
        translationComplete: stillUncachedNodes.length === 0
      };
      
    } catch (error) {
      console.error('[SimplifiedSoulNetTranslationService] ENHANCED: Error getting translations:', error);
      
      // Return fallback translations
      const fallbackTranslations = new Map<string, string>();
      nodeIds.forEach(nodeId => fallbackTranslations.set(nodeId, nodeId));
      
      return {
        translations: fallbackTranslations,
        isTranslating: false,
        progress: 100,
        translationComplete: true
      };
    }
  }

  // Memory cache management
  private static updateMemoryCache(language: string, translations: Map<string, string>): void {
    if (!this.memoryCache.has(language)) {
      this.memoryCache.set(language, new Map());
    }
    
    const languageCache = this.memoryCache.get(language)!;
    translations.forEach((translation, nodeId) => {
      languageCache.set(nodeId, translation);
    });
    
    // Limit cache size
    if (languageCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(languageCache.entries());
      const keepEntries = entries.slice(-this.MAX_CACHE_SIZE + 100);
      languageCache.clear();
      keepEntries.forEach(([nodeId, translation]) => {
        languageCache.set(nodeId, translation);
      });
    }
    
    console.log(`[SimplifiedSoulNetTranslationService] Updated memory cache for ${language}: ${languageCache.size} entries`);
  }

  private static getFromMemoryCache(language: string, nodeIds: string[]): Map<string, string> {
    const translations = new Map<string, string>();
    const languageCache = this.memoryCache.get(language);
    
    if (languageCache) {
      nodeIds.forEach(nodeId => {
        const cached = languageCache.get(nodeId);
        if (cached) {
          translations.set(nodeId, cached);
        }
      });
    }
    
    return translations;
  }

  // Translation state management
  private static getTranslationState(stateKey: string) {
    const state = this.translationStates.get(stateKey);
    if (!state) {
      return { isTranslating: false, progress: 100, complete: true, startedAt: 0 };
    }

    // Check for timeout (60 seconds for comprehensive pre-translation)
    if (state.isTranslating && (Date.now() - state.startedAt) > 60000) {
      console.log(`[SimplifiedSoulNetTranslationService] Translation timeout for ${stateKey}`);
      this.setTranslationState(stateKey, { isTranslating: false, progress: 100, complete: false });
      return { isTranslating: false, progress: 100, complete: false, startedAt: 0 };
    }

    return state;
  }

  private static setTranslationState(stateKey: string, state: Partial<{ isTranslating: boolean, progress: number, complete: boolean }>) {
    const existing = this.translationStates.get(stateKey) || { isTranslating: false, progress: 100, complete: true, startedAt: 0 };
    
    this.translationStates.set(stateKey, {
      ...existing,
      ...state,
      startedAt: state.isTranslating ? Date.now() : existing.startedAt
    });
  }

  // Cache management
  static clearCache(): void {
    this.memoryCache.clear();
    this.translationStates.clear();
    console.log('[SimplifiedSoulNetTranslationService] Cleared all caches');
  }

  static clearLanguageCache(language: string): void {
    this.memoryCache.delete(language);
    
    // Clear translation states for this language
    const keysToDelete = Array.from(this.translationStates.keys()).filter(key => key.endsWith(`-${language}`));
    keysToDelete.forEach(key => this.translationStates.delete(key));
    
    console.log(`[SimplifiedSoulNetTranslationService] Cleared cache for language: ${language}`);
  }
}
