
import { translationService } from '@/services/translationService';

interface NodeTranslationData {
  originalText: string;
  translatedText: string;
  language: string;
  timestamp: number;
}

interface TranslationBatch {
  nodes: string[];
  language: string;
  timestamp: number;
  completed: boolean;
}

export class NodeTranslationCacheService {
  private static readonly CACHE_KEY = 'soulo-node-translations';
  private static readonly BATCH_CACHE_KEY = 'soulo-translation-batches';
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  
  private static nodeCache = new Map<string, NodeTranslationData>();
  private static batchCache = new Map<string, TranslationBatch>();
  
  static {
    this.loadFromLocalStorage();
  }

  // Load cached translations from localStorage
  private static loadFromLocalStorage(): void {
    try {
      // Load node translations
      const storedNodes = localStorage.getItem(this.CACHE_KEY);
      if (storedNodes) {
        const parsedNodes = JSON.parse(storedNodes);
        Object.entries(parsedNodes).forEach(([key, value]: [string, any]) => {
          this.nodeCache.set(key, value as NodeTranslationData);
        });
        console.log(`[NodeTranslationCacheService] Loaded ${this.nodeCache.size} node translations from storage`);
      }

      // Load batch translations
      const storedBatches = localStorage.getItem(this.BATCH_CACHE_KEY);
      if (storedBatches) {
        const parsedBatches = JSON.parse(storedBatches);
        Object.entries(parsedBatches).forEach(([key, value]: [string, any]) => {
          this.batchCache.set(key, value as TranslationBatch);
        });
        console.log(`[NodeTranslationCacheService] Loaded ${this.batchCache.size} translation batches from storage`);
      }
    } catch (error) {
      console.error('[NodeTranslationCacheService] Error loading from localStorage:', error);
    }
  }

  // Save current cache to localStorage
  private static saveToLocalStorage(): void {
    try {
      // Save node translations
      const nodeObject = Object.fromEntries(this.nodeCache);
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(nodeObject));

      // Save batch translations
      const batchObject = Object.fromEntries(this.batchCache);
      localStorage.setItem(this.BATCH_CACHE_KEY, JSON.stringify(batchObject));
    } catch (error) {
      console.error('[NodeTranslationCacheService] Error saving to localStorage:', error);
    }
  }

  // Get cached translation for a specific node
  static getCachedTranslation(nodeId: string, targetLanguage: string): string | null {
    if (targetLanguage === 'en') return nodeId;
    
    const cacheKey = `${nodeId}_${targetLanguage}`;
    const cached = this.nodeCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      console.log(`[NodeTranslationCacheService] Cache hit for ${nodeId} -> ${targetLanguage}`);
      return cached.translatedText;
    }
    
    if (cached && (Date.now() - cached.timestamp) >= this.CACHE_DURATION) {
      console.log(`[NodeTranslationCacheService] Cache expired for ${nodeId} -> ${targetLanguage}`);
      this.nodeCache.delete(cacheKey);
    }
    
    return null;
  }

  // Cache a single translation
  static setCachedTranslation(nodeId: string, translatedText: string, targetLanguage: string): void {
    if (targetLanguage === 'en' || !nodeId || !translatedText) return;
    
    const cacheKey = `${nodeId}_${targetLanguage}`;
    const translationData: NodeTranslationData = {
      originalText: nodeId,
      translatedText,
      language: targetLanguage,
      timestamp: Date.now()
    };
    
    this.nodeCache.set(cacheKey, translationData);
    this.saveToLocalStorage();
    
    console.log(`[NodeTranslationCacheService] Cached translation: ${nodeId} -> ${translatedText} (${targetLanguage})`);
  }

  // Check if a batch translation is already completed
  static isBatchCompleted(nodeIds: string[], targetLanguage: string): boolean {
    if (targetLanguage === 'en') return true;
    
    const batchKey = this.getBatchKey(nodeIds, targetLanguage);
    const batch = this.batchCache.get(batchKey);
    
    if (batch && batch.completed && (Date.now() - batch.timestamp) < this.CACHE_DURATION) {
      // Verify all nodes in batch are actually cached
      const allCached = nodeIds.every(nodeId => 
        this.getCachedTranslation(nodeId, targetLanguage) !== null
      );
      
      if (allCached) {
        console.log(`[NodeTranslationCacheService] Batch already completed for ${nodeIds.length} nodes (${targetLanguage})`);
        return true;
      } else {
        // Some nodes missing, mark batch as incomplete
        batch.completed = false;
        this.saveToLocalStorage();
      }
    }
    
    return false;
  }

  // Mark a batch as in progress
  static markBatchInProgress(nodeIds: string[], targetLanguage: string): void {
    if (targetLanguage === 'en') return;
    
    const batchKey = this.getBatchKey(nodeIds, targetLanguage);
    const batch: TranslationBatch = {
      nodes: [...nodeIds],
      language: targetLanguage,
      timestamp: Date.now(),
      completed: false
    };
    
    this.batchCache.set(batchKey, batch);
    this.saveToLocalStorage();
    
    console.log(`[NodeTranslationCacheService] Marked batch in progress: ${nodeIds.length} nodes (${targetLanguage})`);
  }

  // Mark a batch as completed
  static markBatchCompleted(nodeIds: string[], targetLanguage: string): void {
    if (targetLanguage === 'en') return;
    
    const batchKey = this.getBatchKey(nodeIds, targetLanguage);
    const batch = this.batchCache.get(batchKey);
    
    if (batch) {
      batch.completed = true;
      batch.timestamp = Date.now();
      this.saveToLocalStorage();
      
      console.log(`[NodeTranslationCacheService] Marked batch completed: ${nodeIds.length} nodes (${targetLanguage})`);
    }
  }

  // Batch translate nodes efficiently
  static async batchTranslateNodes(nodeIds: string[], targetLanguage: string): Promise<Map<string, string>> {
    if (targetLanguage === 'en') {
      const resultMap = new Map<string, string>();
      nodeIds.forEach(nodeId => resultMap.set(nodeId, nodeId));
      return resultMap;
    }

    console.log(`[NodeTranslationCacheService] Starting batch translation: ${nodeIds.length} nodes to ${targetLanguage}`);
    
    // Check what's already cached
    const resultMap = new Map<string, string>();
    const needsTranslation: string[] = [];
    
    nodeIds.forEach(nodeId => {
      const cached = this.getCachedTranslation(nodeId, targetLanguage);
      if (cached) {
        resultMap.set(nodeId, cached);
      } else {
        needsTranslation.push(nodeId);
      }
    });

    if (needsTranslation.length === 0) {
      console.log(`[NodeTranslationCacheService] All ${nodeIds.length} nodes already cached`);
      return resultMap;
    }

    console.log(`[NodeTranslationCacheService] Translating ${needsTranslation.length} uncached nodes`);
    
    try {
      this.markBatchInProgress(needsTranslation, targetLanguage);
      
      const batchResults = await translationService.batchTranslate({
        texts: needsTranslation,
        targetLanguage
      });
      
      // Cache individual results
      batchResults.forEach((translatedText, originalText) => {
        this.setCachedTranslation(originalText, translatedText, targetLanguage);
        resultMap.set(originalText, translatedText);
      });
      
      // Handle any missing translations
      needsTranslation.forEach(nodeId => {
        if (!resultMap.has(nodeId)) {
          console.warn(`[NodeTranslationCacheService] No translation result for: ${nodeId}`);
          resultMap.set(nodeId, nodeId);
          this.setCachedTranslation(nodeId, nodeId, targetLanguage);
        }
      });
      
      this.markBatchCompleted(needsTranslation, targetLanguage);
      
      console.log(`[NodeTranslationCacheService] Batch translation completed: ${needsTranslation.length} nodes`);
      return resultMap;
      
    } catch (error) {
      console.error(`[NodeTranslationCacheService] Batch translation failed:`, error);
      
      // Fallback: use original text for failed translations
      needsTranslation.forEach(nodeId => {
        if (!resultMap.has(nodeId)) {
          resultMap.set(nodeId, nodeId);
          this.setCachedTranslation(nodeId, nodeId, targetLanguage);
        }
      });
      
      return resultMap;
    }
  }

  // Clear cache for specific language
  static clearLanguageCache(targetLanguage: string): void {
    if (targetLanguage === 'en') return;
    
    const keysToDelete: string[] = [];
    
    this.nodeCache.forEach((data, key) => {
      if (data.language === targetLanguage) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.nodeCache.delete(key));
    
    // Clear batch cache for this language
    const batchKeysToDelete: string[] = [];
    this.batchCache.forEach((batch, key) => {
      if (batch.language === targetLanguage) {
        batchKeysToDelete.push(key);
      }
    });
    
    batchKeysToDelete.forEach(key => this.batchCache.delete(key));
    
    this.saveToLocalStorage();
    
    console.log(`[NodeTranslationCacheService] Cleared cache for language: ${targetLanguage}`);
  }

  // Clear all cached translations
  static clearAllCache(): void {
    this.nodeCache.clear();
    this.batchCache.clear();
    localStorage.removeItem(this.CACHE_KEY);
    localStorage.removeItem(this.BATCH_CACHE_KEY);
    
    console.log('[NodeTranslationCacheService] Cleared all translation cache');
  }

  // Get cache statistics
  static getCacheStats(): { nodeCount: number; batchCount: number; languages: string[] } {
    const languages = new Set<string>();
    this.nodeCache.forEach(data => languages.add(data.language));
    
    return {
      nodeCount: this.nodeCache.size,
      batchCount: this.batchCache.size,
      languages: Array.from(languages)
    };
  }

  // Generate batch key for consistent identification
  private static getBatchKey(nodeIds: string[], targetLanguage: string): string {
    const sortedIds = [...nodeIds].sort();
    return `batch_${targetLanguage}_${sortedIds.join('|')}`;
  }
}
