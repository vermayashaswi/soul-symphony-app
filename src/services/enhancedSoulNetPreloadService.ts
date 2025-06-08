import { supabase } from '@/integrations/supabase/client';
import { translationService } from '@/services/translationService';
import { onDemandTranslationCache } from '@/utils/website-translations';

interface NodeData {
  id: string;
  type: 'entity' | 'emotion';
  value: number;
  color: string;
  position: [number, number, number];
}

interface LinkData {
  source: string;
  target: string;
  value: number;
}

interface ProcessedSoulNetData {
  nodes: NodeData[];
  links: LinkData[];
  translations: Map<string, string>;
  connectionPercentages: Map<string, number>;
}

interface CachedSoulNetData {
  data: ProcessedSoulNetData;
  timestamp: number;
  userId: string;
  timeRange: string;
  language: string;
}

export class EnhancedSoulNetPreloadService {
  private static readonly CACHE_KEY = 'enhanced-soulnet-data';
  private static readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  private static cache = new Map<string, CachedSoulNetData>();
  private static readonly MAX_BATCH_SIZE = 250;

  static async preloadSoulNetDataWithEnhancedTranslations(
    userId: string, 
    timeRange: string, 
    language: string
  ): Promise<ProcessedSoulNetData | null> {
    console.log(`[EnhancedSoulNetPreloadService] Starting enhanced preload for ${userId}, ${timeRange}, ${language}`);
    
    const cacheKey = `${userId}-${timeRange}-${language}`;
    const cached = this.getCachedData(cacheKey);
    
    if (cached) {
      console.log(`[EnhancedSoulNetPreloadService] Using enhanced cached data for ${cacheKey}`);
      return cached.data;
    }

    try {
      // Fetch raw journal data with expanded date range for "year" view
      const startDate = this.getExpandedStartDate(timeRange);
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('id, entityemotion, "refined text", "transcription text", created_at')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[EnhancedSoulNetPreloadService] Error fetching journal entries:', error);
        return null;
      }

      if (!entries || entries.length === 0) {
        console.log('[EnhancedSoulNetPreloadService] No entries found');
        return { nodes: [], links: [], translations: new Map(), connectionPercentages: new Map() };
      }

      console.log(`[EnhancedSoulNetPreloadService] Processing ${entries.length} entries for ${timeRange} range`);

      // Process the raw data with enhanced entity detection
      const graphData = this.processEntitiesEnhanced(entries, timeRange);
      
      // Enhanced pre-translation with race condition prevention
      const translations = new Map<string, string>();
      const connectionPercentages = new Map<string, number>();
      
      if (language !== 'en' && graphData.nodes.length > 0) {
        await this.enhancedBatchTranslation(graphData.nodes, language, translations);
      }

      // Pre-calculate connection percentages with enhanced accuracy
      this.calculateEnhancedConnectionPercentages(graphData, connectionPercentages);

      const processedData: ProcessedSoulNetData = {
        nodes: graphData.nodes,
        links: graphData.links,
        translations,
        connectionPercentages
      };

      // Cache with enhanced storage
      this.setCachedData(cacheKey, {
        data: processedData,
        timestamp: Date.now(),
        userId,
        timeRange,
        language
      });

      console.log(`[EnhancedSoulNetPreloadService] Successfully preloaded enhanced data with ${processedData.nodes.length} nodes and ${processedData.translations.size} translations`);
      return processedData;
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] Error in enhanced preload:', error);
      return null;
    }
  }

  private static async enhancedBatchTranslation(
    nodes: NodeData[],
    language: string,
    translations: Map<string, string>
  ): Promise<void> {
    const nodesToTranslate = [...new Set(nodes.map(node => node.id))];
    console.log(`[EnhancedSoulNetPreloadService] Enhanced batch translating ${nodesToTranslate.length} unique nodes`);

    try {
      // Process in optimized batches
      const batches = this.createOptimizedBatches(nodesToTranslate);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`[EnhancedSoulNetPreloadService] Processing enhanced batch ${i + 1}/${batches.length} with ${batch.length} items`);

        try {
          const batchResults = await translationService.batchTranslate({
            texts: batch,
            targetLanguage: language
          });

          // Store results with race condition prevention
          batchResults.forEach((translatedText, originalText) => {
            translations.set(originalText, translatedText);
            // Immediately cache in on-demand cache for instant access
            onDemandTranslationCache.set(language, originalText, translatedText);
          });

          console.log(`[EnhancedSoulNetPreloadService] Enhanced batch ${i + 1} completed: ${batchResults.size} translations`);
        } catch (batchError) {
          console.error(`[EnhancedSoulNetPreloadService] Enhanced batch ${i + 1} failed:`, batchError);
          
          // Fallback to individual translations for failed batch
          await this.fallbackIndividualTranslations(batch, language, translations);
        }

        // Small delay between batches to prevent rate limiting
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] Error in enhanced batch translation:', error);
      
      // Ultimate fallback: set original text for all nodes
      nodesToTranslate.forEach(nodeId => {
        if (!translations.has(nodeId)) {
          translations.set(nodeId, nodeId);
        }
      });
    }
  }

  private static createOptimizedBatches(texts: string[]): string[][] {
    const batches: string[][] = [];
    let currentBatch: string[] = [];
    let currentBatchSize = 0;

    for (const text of texts) {
      const textSize = text.length;
      
      // Start new batch if current would exceed limits
      if (currentBatch.length >= this.MAX_BATCH_SIZE || 
          (currentBatchSize + textSize > 5000 && currentBatch.length > 0)) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchSize = 0;
      }
      
      currentBatch.push(text);
      currentBatchSize += textSize;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  private static async fallbackIndividualTranslations(
    batch: string[], 
    targetLanguage: string, 
    translations: Map<string, string>
  ): Promise<void> {
    console.log(`[EnhancedSoulNetPreloadService] Enhanced fallback for ${batch.length} items`);
    
    for (const text of batch) {
      try {
        const translated = await translationService.translateText(text, targetLanguage);
        translations.set(text, translated);
        onDemandTranslationCache.set(targetLanguage, text, translated);
      } catch (error) {
        console.error(`[EnhancedSoulNetPreloadService] Individual enhanced translation failed for "${text}":`, error);
        translations.set(text, text); // Use original as fallback
      }
    }
  }

  private static getExpandedStartDate(timeRange: string): Date {
    const now = new Date();
    switch (timeRange) {
      case 'today':
        return new Date(now.setHours(0, 0, 0, 0));
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        return weekStart;
      case 'month':
        const monthStart = new Date(now);
        monthStart.setMonth(monthStart.getMonth() - 1);
        return monthStart;
      case 'year':
        // Expanded range for year view to capture more entities
        const yearStart = new Date(now);
        yearStart.setFullYear(yearStart.getFullYear() - 1);
        return yearStart;
      default:
        const defaultStart = new Date(now);
        defaultStart.setDate(defaultStart.getDate() - 7);
        return defaultStart;
    }
  }

  private static processEntitiesEnhanced(entries: any[], timeRange: string): { nodes: NodeData[], links: LinkData[] } {
    console.log(`[EnhancedSoulNetPreloadService] Enhanced processing ${entries.length} entries for ${timeRange}`);
    
    const entityEmotionMap: Record<string, Record<string, number>> = {};
    const entityCounts: Record<string, number> = {};
    
    entries.forEach(entry => {
      if (!entry.entityemotion) return;
      
      Object.entries(entry.entityemotion).forEach(([entity, emotions]) => {
        if (typeof emotions !== 'object') return;
        
        // Track entity frequency
        entityCounts[entity] = (entityCounts[entity] || 0) + 1;
        
        if (!entityEmotionMap[entity]) {
          entityEmotionMap[entity] = {};
        }
        
        Object.entries(emotions).forEach(([emotion, score]) => {
          if (typeof score !== 'number') return;
          
          if (entityEmotionMap[entity][emotion]) {
            entityEmotionMap[entity][emotion] += score;
          } else {
            entityEmotionMap[entity][emotion] = score;
          }
        });
      });
    });

    // Enhanced filtering for "year" view to include more relevant entities
    const filteredEntityEmotionMap = this.filterEntitiesByRelevance(
      entityEmotionMap, 
      entityCounts, 
      timeRange
    );

    return this.generateEnhancedGraph(filteredEntityEmotionMap);
  }

  private static filterEntitiesByRelevance(
    entityEmotionMap: Record<string, Record<string, number>>,
    entityCounts: Record<string, number>,
    timeRange: string
  ): Record<string, Record<string, number>> {
    if (timeRange !== 'year') {
      return entityEmotionMap; // No filtering for shorter time ranges
    }

    // For year view, include entities that appear multiple times or have strong emotional connections
    const filteredMap: Record<string, Record<string, number>> = {};
    
    Object.entries(entityEmotionMap).forEach(([entity, emotions]) => {
      const entityFrequency = entityCounts[entity] || 0;
      const maxEmotionScore = Math.max(...Object.values(emotions));
      
      // Include if entity appears frequently OR has strong emotional connections
      if (entityFrequency >= 2 || maxEmotionScore >= 0.5) {
        filteredMap[entity] = emotions;
      }
    });

    console.log(`[EnhancedSoulNetPreloadService] Enhanced filtering for year view: ${Object.keys(entityEmotionMap).length} -> ${Object.keys(filteredMap).length} entities`);
    return filteredMap;
  }

  private static generateEnhancedGraph(entityEmotionMap: Record<string, Record<string, number>>): { nodes: NodeData[], links: LinkData[] } {
    // ... keep existing code (generateGraph implementation from original service)
    const nodes: NodeData[] = [];
    const links: LinkData[] = [];
    const entityNodes = new Set<string>();
    const emotionNodes = new Set<string>();

    const entityList = Object.keys(entityEmotionMap);
    const EMOTION_LAYER_RADIUS = 11;
    const ENTITY_LAYER_RADIUS = 6;
    const EMOTION_Y_SPAN = 6;
    const ENTITY_Y_SPAN = 3;

    console.log("[EnhancedSoulNetPreloadService] Generating enhanced graph with", entityList.length, "entities");
    
    entityList.forEach((entity, entityIndex) => {
      entityNodes.add(entity);
      const entityAngle = (entityIndex / entityList.length) * Math.PI * 2;
      const entityRadius = ENTITY_LAYER_RADIUS;
      const entityX = Math.cos(entityAngle) * entityRadius;
      const entityY = ((entityIndex % 2) === 0 ? -1 : 1) * 0.7 * (Math.random() - 0.5) * ENTITY_Y_SPAN;
      const entityZ = Math.sin(entityAngle) * entityRadius;
      
      nodes.push({
        id: entity,
        type: 'entity',
        value: 1,
        color: '#fff',
        position: [entityX, entityY, entityZ]
      });

      Object.entries(entityEmotionMap[entity]).forEach(([emotion, score]) => {
        emotionNodes.add(emotion);
        links.push({
          source: entity,
          target: emotion,
          value: score
        });
      });
    });

    Array.from(emotionNodes).forEach((emotion, emotionIndex) => {
      const emotionAngle = (emotionIndex / emotionNodes.size) * Math.PI * 2;
      const emotionRadius = EMOTION_LAYER_RADIUS;
      const emotionX = Math.cos(emotionAngle) * emotionRadius;
      const emotionY = ((emotionIndex % 2) === 0 ? -1 : 1) * 0.7 * (Math.random() - 0.5) * EMOTION_Y_SPAN;
      const emotionZ = Math.sin(emotionAngle) * emotionRadius;
      
      nodes.push({
        id: emotion,
        type: 'emotion',
        value: 0.8,
        color: '#fff',
        position: [emotionX, emotionY, emotionZ]
      });
    });

    console.log("[EnhancedSoulNetPreloadService] Generated enhanced graph with", nodes.length, "nodes and", links.length, "links");
    return { nodes, links };
  }

  private static calculateEnhancedConnectionPercentages(
    graphData: { nodes: NodeData[], links: LinkData[] },
    percentageMap: Map<string, number>
  ): void {
    console.log('[EnhancedSoulNetPreloadService] Calculating enhanced connection percentages');
    
    const nodeConnectionTotals = new Map<string, number>();
    
    graphData.links.forEach(link => {
      const sourceTotal = nodeConnectionTotals.get(link.source) || 0;
      const targetTotal = nodeConnectionTotals.get(link.target) || 0;
      
      nodeConnectionTotals.set(link.source, sourceTotal + link.value);
      nodeConnectionTotals.set(link.target, targetTotal + link.value);
    });

    graphData.links.forEach(link => {
      const sourceTotal = nodeConnectionTotals.get(link.source) || 1;
      const targetTotal = nodeConnectionTotals.get(link.target) || 1;
      
      const sourcePercentage = Math.round((link.value / sourceTotal) * 100);
      percentageMap.set(`${link.source}-${link.target}`, sourcePercentage);
      
      const targetPercentage = Math.round((link.value / targetTotal) * 100);
      percentageMap.set(`${link.target}-${link.source}`, targetPercentage);
    });

    console.log(`[EnhancedSoulNetPreloadService] Calculated ${percentageMap.size} enhanced connection percentages`);
  }

  private static getCachedData(cacheKey: string): CachedSoulNetData | null {
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached;
    }
    
    try {
      const storedData = localStorage.getItem(`${this.CACHE_KEY}-${cacheKey}`);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if ((Date.now() - parsed.timestamp) < this.CACHE_DURATION) {
          parsed.data.translations = new Map(Object.entries(parsed.data.translations || {}));
          parsed.data.connectionPercentages = new Map(Object.entries(parsed.data.connectionPercentages || {}));
          this.cache.set(cacheKey, parsed);
          return parsed;
        }
      }
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] Error loading from localStorage:', error);
    }
    
    return null;
  }

  private static setCachedData(cacheKey: string, data: CachedSoulNetData): void {
    this.cache.set(cacheKey, data);
    
    try {
      const storableData = {
        ...data,
        data: {
          ...data.data,
          translations: Object.fromEntries(data.data.translations),
          connectionPercentages: Object.fromEntries(data.data.connectionPercentages)
        }
      };
      localStorage.setItem(`${this.CACHE_KEY}-${cacheKey}`, JSON.stringify(storableData));
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] Error saving to localStorage:', error);
    }
  }

  static clearCache(userId?: string): void {
    if (userId) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(userId));
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        localStorage.removeItem(`${this.CACHE_KEY}-${key}`);
      });
      console.log(`[EnhancedSoulNetPreloadService] Cleared enhanced cache for user ${userId}`);
    } else {
      this.cache.clear();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.CACHE_KEY)) {
          localStorage.removeItem(key);
        }
      });
      console.log('[EnhancedSoulNetPreloadService] Cleared all enhanced cache');
    }
  }

  // Integrate with existing service
  static getCachedDataSync(cacheKey: string): ProcessedSoulNetData | null {
    const cached = this.getCachedData(cacheKey);
    return cached ? cached.data : null;
  }

  // Main interface method
  static async preloadSoulNetData(
    userId: string, 
    timeRange: string, 
    language: string
  ): Promise<ProcessedSoulNetData | null> {
    return this.preloadSoulNetDataWithEnhancedTranslations(userId, timeRange, language);
  }
}
