import { supabase } from '@/integrations/supabase/client';
import { translationService } from '@/services/translationService';
import { NodeTranslationCacheService } from '@/services/nodeTranslationCache';
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

export class SoulNetPreloadService {
  private static readonly CACHE_KEY = 'soulnet-preloaded-data';
  private static readonly CACHE_DURATION = 10 * 60 * 1000; // Extended to 10 minutes
  private static cache = new Map<string, CachedSoulNetData>();

  static async preloadSoulNetData(
    userId: string, 
    timeRange: string, 
    language: string
  ): Promise<ProcessedSoulNetData | null> {
    console.log(`[SoulNetPreloadService] OPTIMIZED: Preloading data for user ${userId}, range ${timeRange}, language ${language}`);
    
    // Generate cache key without language for graph data
    const graphCacheKey = `${userId}-${timeRange}-graph`;
    const translationCacheKey = `${userId}-${timeRange}-${language}`;
    
    // Check if we have cached graph data (language-independent)
    let graphData: { nodes: NodeData[], links: LinkData[] } | null = null;
    const cachedGraphData = this.getCachedData(graphCacheKey);
    
    if (cachedGraphData) {
      console.log(`[SoulNetPreloadService] OPTIMIZED: Using cached graph data for ${graphCacheKey}`);
      graphData = { nodes: cachedGraphData.data.nodes, links: cachedGraphData.data.links };
    } else {
      // Fetch and process raw journal data
      graphData = await this.fetchAndProcessGraphData(userId, timeRange);
      if (!graphData) {
        return null;
      }
      
      // Cache graph data (language-independent)
      this.setCachedData(graphCacheKey, {
        data: { 
          nodes: graphData.nodes, 
          links: graphData.links, 
          translations: new Map(), 
          connectionPercentages: new Map() 
        },
        timestamp: Date.now(),
        userId,
        timeRange,
        language: 'graph' // Special marker for graph data
      });
    }

    // Now handle translations optimally
    const translations = new Map<string, string>();
    const connectionPercentages = new Map<string, number>();
    
    if (language !== 'en' && graphData.nodes.length > 0) {
      console.log(`[SoulNetPreloadService] OPTIMIZED: Processing node translations for ${language}`);
      
      // Get unique node IDs
      const nodeIds = [...new Set(graphData.nodes.map(node => node.id))];
      
      // Check which nodes already have cached translations
      const cachedTranslations = await NodeTranslationCacheService.getBatchCachedTranslations(nodeIds, language);
      
      // Identify nodes that need translation
      const uncachedNodes = nodeIds.filter(nodeId => !cachedTranslations.has(nodeId));
      
      console.log(`[SoulNetPreloadService] OPTIMIZED: Found ${cachedTranslations.size} cached translations, need to translate ${uncachedNodes.length} nodes`);
      
      // Add cached translations to results
      cachedTranslations.forEach((translation, nodeId) => {
        translations.set(nodeId, translation);
      });
      
      // Translate uncached nodes if any
      if (uncachedNodes.length > 0) {
        try {
          const batchResults = await translationService.batchTranslate({
            texts: uncachedNodes,
            targetLanguage: language
          });
          
          console.log(`[SoulNetPreloadService] OPTIMIZED: Successfully translated ${batchResults.size}/${uncachedNodes.length} new nodes`);
          
          // Store new translations in cache and results
          await NodeTranslationCacheService.setBatchCachedTranslations(batchResults, language);
          
          batchResults.forEach((translatedText, originalText) => {
            translations.set(originalText, translatedText);
            // Also cache in on-demand cache for immediate access
            onDemandTranslationCache.set(language, originalText, translatedText);
          });
        } catch (error) {
          console.error('[SoulNetPreloadService] OPTIMIZED: Error during batch translation:', error);
          // Use original text for failed translations
          uncachedNodes.forEach(nodeId => {
            translations.set(nodeId, nodeId);
          });
        }
      }

      // Ensure all nodes have translations
      nodeIds.forEach(nodeId => {
        if (!translations.has(nodeId)) {
          console.warn(`[SoulNetPreloadService] OPTIMIZED: No translation found for node: ${nodeId}, using original`);
          translations.set(nodeId, nodeId);
        }
      });
    }

    // Pre-calculate connection percentages
    this.calculateConnectionPercentages(graphData, connectionPercentages);

    const processedData: ProcessedSoulNetData = {
      nodes: graphData.nodes,
      links: graphData.links,
      translations,
      connectionPercentages
    };

    // Cache the complete processed data
    this.setCachedData(translationCacheKey, {
      data: processedData,
      timestamp: Date.now(),
      userId,
      timeRange,
      language
    });

    console.log(`[SoulNetPreloadService] OPTIMIZED: Successfully processed data with ${processedData.nodes.length} nodes and ${processedData.translations.size} translations`);
    return processedData;
  }

  private static async fetchAndProcessGraphData(
    userId: string, 
    timeRange: string
  ): Promise<{ nodes: NodeData[], links: LinkData[] } | null> {
    try {
      // Fetch raw journal data - FIXED: Use themeemotion instead of entityemotion
      const startDate = this.getStartDate(timeRange);
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('id, themeemotion, "refined text", "transcription text"')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[SoulNetPreloadService] OPTIMIZED: Error fetching journal entries:', error);
        return null;
      }

      if (!entries || entries.length === 0) {
        console.log('[SoulNetPreloadService] OPTIMIZED: No entries found');
        return { nodes: [], links: [] };
      }

      console.log(`[SoulNetPreloadService] OPTIMIZED: Found ${entries.length} entries for processing`);

      // Process the raw data
      return this.processEntities(entries);
    } catch (error) {
      console.error('[SoulNetPreloadService] OPTIMIZED: Error fetching graph data:', error);
      return null;
    }
  }

  static getCachedDataSync(cacheKey: string): ProcessedSoulNetData | null {
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      console.log(`[SoulNetPreloadService] OPTIMIZED: Found valid cache for ${cacheKey}`);
      return cached.data;
    }
    
    // Try localStorage as fallback
    try {
      const storedData = localStorage.getItem(`${this.CACHE_KEY}-${cacheKey}`);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if ((Date.now() - parsed.timestamp) < this.CACHE_DURATION) {
          // Convert Maps back from objects
          parsed.data.translations = new Map(Object.entries(parsed.data.translations || {}));
          parsed.data.connectionPercentages = new Map(Object.entries(parsed.data.connectionPercentages || {}));
          this.cache.set(cacheKey, parsed);
          console.log(`[SoulNetPreloadService] OPTIMIZED: Found valid localStorage cache for ${cacheKey}`);
          return parsed.data;
        }
      }
    } catch (error) {
      console.error('[SoulNetPreloadService] OPTIMIZED: Error loading from localStorage:', error);
    }
    
    console.log(`[SoulNetPreloadService] OPTIMIZED: No valid cache found for ${cacheKey}`);
    return null;
  }

  private static getCachedData(cacheKey: string): CachedSoulNetData | null {
    const syncResult = this.getCachedDataSync(cacheKey);
    if (syncResult) {
      return this.cache.get(cacheKey) || null;
    }
    return null;
  }

  private static setCachedData(cacheKey: string, data: CachedSoulNetData): void {
    this.cache.set(cacheKey, data);
    
    // Also store in localStorage
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
      console.error('[SoulNetPreloadService] OPTIMIZED: Error saving to localStorage:', error);
    }
  }

  private static calculateConnectionPercentages(
    graphData: { nodes: NodeData[], links: LinkData[] },
    percentageMap: Map<string, number>
  ): void {
    console.log('[SoulNetPreloadService] Pre-calculating connection percentages');
    
    // Calculate total connection strength for each node
    const nodeConnectionTotals = new Map<string, number>();
    
    graphData.links.forEach(link => {
      const sourceTotal = nodeConnectionTotals.get(link.source) || 0;
      const targetTotal = nodeConnectionTotals.get(link.target) || 0;
      
      nodeConnectionTotals.set(link.source, sourceTotal + link.value);
      nodeConnectionTotals.set(link.target, targetTotal + link.value);
    });

    // Calculate percentages for each connection
    graphData.links.forEach(link => {
      const sourceTotal = nodeConnectionTotals.get(link.source) || 1;
      const targetTotal = nodeConnectionTotals.get(link.target) || 1;
      
      // Calculate percentage from source perspective
      const sourcePercentage = Math.round((link.value / sourceTotal) * 100);
      percentageMap.set(`${link.source}-${link.target}`, sourcePercentage);
      
      // Calculate percentage from target perspective
      const targetPercentage = Math.round((link.value / targetTotal) * 100);
      percentageMap.set(`${link.target}-${link.source}`, targetPercentage);
    });

    console.log(`[SoulNetPreloadService] Pre-calculated ${percentageMap.size} connection percentages`);
  }

  private static getStartDate(timeRange: string): Date {
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
        const yearStart = new Date(now);
        yearStart.setFullYear(yearStart.getFullYear() - 1);
        return yearStart;
      default:
        const defaultStart = new Date(now);
        defaultStart.setDate(defaultStart.getDate() - 7);
        return defaultStart;
    }
  }

  private static processEntities(entries: any[]): { nodes: NodeData[], links: LinkData[] } {
    console.log("[SoulNetPreloadService] Processing entities for", entries.length, "entries");
    
    const entityEmotionMap: Record<string, Record<string, number>> = {};
    
    entries.forEach(entry => {
      // FIXED: Use themeemotion instead of entityemotion
      if (!entry.themeemotion) return;
      
      Object.entries(entry.themeemotion).forEach(([entity, emotions]) => {
        if (typeof emotions !== 'object') return;
        
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

    return this.generateGraph(entityEmotionMap);
  }

  private static generateGraph(entityEmotionMap: Record<string, Record<string, number>>): { nodes: NodeData[], links: LinkData[] } {
    const nodes: NodeData[] = [];
    const links: LinkData[] = [];
    const entityNodes = new Set<string>();
    const emotionNodes = new Set<string>();

    const entityList = Object.keys(entityEmotionMap);
    const EMOTION_LAYER_RADIUS = 11;
    const ENTITY_LAYER_RADIUS = 6;
    const EMOTION_Y_SPAN = 6;
    const ENTITY_Y_SPAN = 3;

    console.log("[SoulNetPreloadService] Generating graph with", entityList.length, "entities");
    
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

    console.log("[SoulNetPreloadService] Generated graph with", nodes.length, "nodes and", links.length, "links");
    return { nodes, links };
  }

  static clearCache(userId?: string): void {
    if (userId) {
      // Clear specific user's cache
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(userId));
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        localStorage.removeItem(`${this.CACHE_KEY}-${key}`);
      });
      
      // Also clear node translation cache
      NodeTranslationCacheService.clearCache();
      
      console.log(`[SoulNetPreloadService] OPTIMIZED: Cleared cache for user ${userId}`);
    } else {
      // Clear all cache
      this.cache.clear();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.CACHE_KEY)) {
          localStorage.removeItem(key);
        }
      });
      
      // Also clear node translation cache
      NodeTranslationCacheService.clearCache();
      
      console.log('[SoulNetPreloadService] OPTIMIZED: Cleared all cache');
    }
  }
}
