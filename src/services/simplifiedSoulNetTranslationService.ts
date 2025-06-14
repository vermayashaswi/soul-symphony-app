
import { translationService } from '@/services/translationService';
import { NodeTranslationCacheService } from '@/services/nodeTranslationCache';

interface SimplifiedTranslationResult {
  translations: Map<string, string>;
  isTranslating: boolean;
  translationComplete: boolean;
  progress: number;
}

export class SimplifiedSoulNetTranslationService {
  private static translationStates = new Map<string, {
    isTranslating: boolean;
    progress: number;
    complete: boolean;
    startedAt: number;
  }>();

  // CACHE-FIRST: Optimized method for getting translations with immediate cache lookup
  static async getTranslationsForLanguage(
    nodeIds: string[],
    targetLanguage: string,
    userId: string
  ): Promise<SimplifiedTranslationResult> {
    const stateKey = `${userId}-${targetLanguage}`;
    
    console.log(`[SimplifiedSoulNetTranslationService] CACHE-FIRST: Getting translations for ${nodeIds.length} nodes in ${targetLanguage}`);

    // English doesn't need translation
    if (targetLanguage === 'en') {
      const translations = new Map<string, string>();
      nodeIds.forEach(nodeId => translations.set(nodeId, nodeId));
      this.setTranslationState(stateKey, { isTranslating: false, progress: 100, complete: true });
      return { translations, isTranslating: false, translationComplete: true, progress: 100 };
    }

    // CACHE-FIRST: Get all cached translations immediately
    console.log(`[SimplifiedSoulNetTranslationService] CACHE-FIRST: Loading cached translations for ${nodeIds.length} nodes`);
    const cachedTranslations = await NodeTranslationCacheService.getBatchCachedTranslations(nodeIds, targetLanguage);
    const translations = new Map<string, string>(cachedTranslations);
    
    const currentProgress = Math.round((translations.size / nodeIds.length) * 100);
    const uncachedNodes = nodeIds.filter(nodeId => !translations.has(nodeId));

    console.log(`[SimplifiedSoulNetTranslationService] CACHE-FIRST: Cached: ${translations.size}/${nodeIds.length} (${currentProgress}%), uncached: ${uncachedNodes.length}`);

    // If we have 100% cached translations, we're done
    if (uncachedNodes.length === 0) {
      this.setTranslationState(stateKey, { isTranslating: false, progress: 100, complete: true });
      return { translations, isTranslating: false, translationComplete: true, progress: 100 };
    }

    // Check if translation is already in progress for remaining nodes
    const currentState = this.getTranslationState(stateKey);
    if (currentState.isTranslating) {
      console.log(`[SimplifiedSoulNetTranslationService] CACHE-FIRST: Translation already in progress for ${stateKey}`);
      return { translations, isTranslating: true, translationComplete: false, progress: currentProgress };
    }

    // OPTIMIZED: If we have 70%+ coverage, mark as ready to render but continue translating
    const hasMinimumCoverage = currentProgress >= 70;
    
    if (hasMinimumCoverage) {
      console.log(`[SimplifiedSoulNetTranslationService] CACHE-FIRST: Sufficient coverage (${currentProgress}%), starting background translation`);
    } else {
      console.log(`[SimplifiedSoulNetTranslationService] CACHE-FIRST: Insufficient coverage (${currentProgress}%), translating remaining nodes`);
    }

    // Start background translation for uncached nodes
    this.setTranslationState(stateKey, { isTranslating: true, progress: currentProgress, complete: hasMinimumCoverage });
    
    // Perform translation in background
    this.performOptimizedTranslation(uncachedNodes, targetLanguage, stateKey, currentProgress).catch(error => {
      console.error('[SimplifiedSoulNetTranslationService] CACHE-FIRST: Background translation error:', error);
      this.setTranslationState(stateKey, { isTranslating: false, progress: 100, complete: false });
    });

    return { 
      translations, 
      isTranslating: !hasMinimumCoverage, 
      translationComplete: hasMinimumCoverage, 
      progress: currentProgress 
    };
  }

  // OPTIMIZED: Background translation with better progress tracking
  private static async performOptimizedTranslation(
    nodeIds: string[],
    targetLanguage: string,
    stateKey: string,
    initialProgress: number
  ): Promise<void> {
    try {
      console.log(`[SimplifiedSoulNetTranslationService] OPTIMIZED: Starting background translation for ${nodeIds.length} nodes`);

      const batchResults = await translationService.batchTranslate({
        texts: nodeIds,
        targetLanguage: targetLanguage,
        sourceLanguage: 'en'
      });

      const newTranslations = new Map<string, string>();
      nodeIds.forEach(nodeId => {
        const translatedText = batchResults.get(nodeId);
        if (translatedText && translatedText.trim()) {
          newTranslations.set(nodeId, translatedText);
        } else {
          newTranslations.set(nodeId, nodeId);
        }
      });

      // Cache new translations with enhanced error handling
      if (newTranslations.size > 0) {
        try {
          await NodeTranslationCacheService.setBatchCachedTranslations(newTranslations, targetLanguage);
          console.log(`[SimplifiedSoulNetTranslationService] OPTIMIZED: Successfully cached ${newTranslations.size} new translations`);
        } catch (cacheError) {
          console.error('[SimplifiedSoulNetTranslationService] OPTIMIZED: Error caching translations:', cacheError);
          // Continue execution even if caching fails
        }
      }

      // Mark translation as complete
      this.setTranslationState(stateKey, { isTranslating: false, progress: 100, complete: true });

      console.log('[SimplifiedSoulNetTranslationService] OPTIMIZED: Translation completed successfully');

      // Emit completion event
      window.dispatchEvent(new CustomEvent('soulNetTranslationComplete', {
        detail: { language: targetLanguage, nodeCount: nodeIds.length, stateKey }
      }));

    } catch (error) {
      console.error('[SimplifiedSoulNetTranslationService] OPTIMIZED: Background translation failed:', error);
      this.setTranslationState(stateKey, { isTranslating: false, progress: 100, complete: false });
    }
  }

  // OPTIMIZED: Enhanced translation state management
  static getTranslationState(stateKey: string) {
    const state = this.translationStates.get(stateKey);
    if (!state) {
      return { isTranslating: false, progress: 100, complete: true, startedAt: 0 };
    }

    // Check for timeout (45 seconds for better reliability)
    if (state.isTranslating && (Date.now() - state.startedAt) > 45000) {
      console.log(`[SimplifiedSoulNetTranslationService] OPTIMIZED: Translation timeout for ${stateKey}`);
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

  // CACHE-FIRST: Get cached translation for a single node
  static async getCachedTranslation(nodeId: string, targetLanguage: string): Promise<string> {
    if (targetLanguage === 'en') {
      return nodeId;
    }

    try {
      const cached = await NodeTranslationCacheService.getCachedNodeTranslation(nodeId, targetLanguage);
      return cached || nodeId;
    } catch (error) {
      console.error('[SimplifiedSoulNetTranslationService] CACHE-FIRST: Error getting cached translation:', error);
      return nodeId;
    }
  }

  // Clear translation states with enhanced cleanup
  static clearTranslationStates(userId?: string): void {
    if (userId) {
      const keysToDelete = Array.from(this.translationStates.keys()).filter(key => key.startsWith(userId));
      keysToDelete.forEach(key => this.translationStates.delete(key));
      console.log(`[SimplifiedSoulNetTranslationService] OPTIMIZED: Cleared translation states for user ${userId}`);
    } else {
      this.translationStates.clear();
      console.log('[SimplifiedSoulNetTranslationService] OPTIMIZED: Cleared all translation states');
    }
  }
}
