
import { supabase } from '@/integrations/supabase/client';
import { translationService } from '@/services/translationService';
import { NodeTranslationCacheService } from '@/services/nodeTranslationCache';

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

interface NodeConnectionData {
  connectedNodes: string[];
  totalStrength: number;
  averageStrength: number;
}

interface EnhancedSoulNetData {
  nodes: NodeData[];
  links: LinkData[];
  translations: Map<string, string>;
  connectionPercentages: Map<string, number>;
  nodeConnectionData: Map<string, NodeConnectionData>;
  translationProgress: number;
  translationComplete: boolean;
}

interface CachedSoulNetData {
  data: EnhancedSoulNetData;
  timestamp: number;
  userId: string;
  timeRange: string;
  language: string;
}

interface TranslationState {
  isTranslating: boolean;
  progress: number;
}

export class EnhancedSoulNetPreloadService {
  private static readonly CACHE_KEY = 'enhanced-soulnet-data';
  private static readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  private static cache = new Map<string, CachedSoulNetData>();
  private static translationStates = new Map<string, TranslationState>();
  private static appLevelTranslationService: any = null;

  // NEW: Set app-level translation service for fallback
  static setAppLevelTranslationService(service: any): void {
    this.appLevelTranslationService = service;
    console.log('[EnhancedSoulNetPreloadService] App-level translation service set');
  }

  // NEW: Language-independent graph data caching
  private static getGraphCacheKey(userId: string, timeRange: string): string {
    return `${userId}-${timeRange}-graph`;
  }

  private static getTranslationCacheKey(userId: string, timeRange: string, language: string): string {
    return `${userId}-${timeRange}-${language}`;
  }

  static async preloadInstantData(
    userId: string,
    timeRange: string,
    language: string
  ): Promise<EnhancedSoulNetData | null> {
    console.log(`[EnhancedSoulNetPreloadService] Preloading instant data for ${userId}, ${timeRange}, ${language}`);
    
    const translationCacheKey = this.getTranslationCacheKey(userId, timeRange, language);
    
    // Check if we have complete cached data first
    const cached = this.getInstantData(translationCacheKey);
    if (cached && cached.data.translationComplete) {
      console.log('[EnhancedSoulNetPreloadService] Using complete cached instant data');
      return cached.data;
    }

    try {
      // Step 1: Get language-independent graph data
      const graphData = await this.getOrFetchGraphData(userId, timeRange);
      if (!graphData || graphData.nodes.length === 0) {
        console.log('[EnhancedSoulNetPreloadService] No graph data available');
        return null;
      }

      // Step 2: Handle translations based on language
      let translations = new Map<string, string>();
      let translationComplete = true;
      let translationProgress = 100;

      if (language !== 'en') {
        console.log('[EnhancedSoulNetPreloadService] Processing translations for non-English language');
        this.setTranslationState(translationCacheKey, { isTranslating: true, progress: 0 });
        
        const nodeIds = [...new Set(graphData.nodes.map(node => node.id))];
        
        // Check node translation cache first
        const cachedTranslations = await NodeTranslationCacheService.getBatchCachedTranslations(nodeIds, language);
        console.log(`[EnhancedSoulNetPreloadService] Found ${cachedTranslations.size}/${nodeIds.length} cached node translations`);
        
        // Add cached translations
        cachedTranslations.forEach((translation, nodeId) => {
          translations.set(nodeId, translation);
        });

        // Get uncached nodes
        const uncachedNodes = nodeIds.filter(nodeId => !cachedTranslations.has(nodeId));
        
        if (uncachedNodes.length > 0) {
          console.log(`[EnhancedSoulNetPreloadService] Translating ${uncachedNodes.length} uncached nodes`);
          
          try {
            // Use app-level translation service for batch translation
            if (this.appLevelTranslationService) {
              const batchResults = await this.appLevelTranslationService.batchTranslate({
                texts: uncachedNodes,
                targetLanguage: language
              });

              let successCount = 0;
              uncachedNodes.forEach(nodeId => {
                const translation = batchResults.get(nodeId);
                if (translation && translation !== nodeId) {
                  translations.set(nodeId, translation);
                  successCount++;
                } else {
                  translations.set(nodeId, nodeId); // Fallback to original
                }
              });

              // Cache successful translations
              if (successCount > 0) {
                const successfulTranslations = new Map<string, string>();
                uncachedNodes.forEach(nodeId => {
                  const translation = batchResults.get(nodeId);
                  if (translation && translation !== nodeId) {
                    successfulTranslations.set(nodeId, translation);
                  }
                });
                await NodeTranslationCacheService.setBatchCachedTranslations(successfulTranslations, language);
              }

              translationProgress = 100;
              console.log(`[EnhancedSoulNetPreloadService] Batch translation completed: ${successCount}/${uncachedNodes.length} successful`);
            } else {
              console.warn('[EnhancedSoulNetPreloadService] No app-level translation service available');
              uncachedNodes.forEach(nodeId => {
                translations.set(nodeId, nodeId);
              });
            }
          } catch (error) {
            console.error('[EnhancedSoulNetPreloadService] Translation error:', error);
            uncachedNodes.forEach(nodeId => {
              translations.set(nodeId, nodeId);
            });
          }
        }
        
        this.setTranslationState(translationCacheKey, { isTranslating: false, progress: 100 });
      } else {
        // For English, use node IDs as translations
        graphData.nodes.forEach(node => {
          translations.set(node.id, node.id);
        });
      }

      // Step 3: Calculate connection data
      const connectionPercentages = new Map<string, number>();
      const nodeConnectionData = new Map<string, NodeConnectionData>();
      
      this.calculateConnectionData(graphData, connectionPercentages, nodeConnectionData);

      const enhancedData: EnhancedSoulNetData = {
        nodes: graphData.nodes,
        links: graphData.links,
        translations,
        connectionPercentages,
        nodeConnectionData,
        translationProgress,
        translationComplete
      };

      // Cache the complete data
      this.setInstantData(translationCacheKey, {
        data: enhancedData,
        timestamp: Date.now(),
        userId,
        timeRange,
        language
      });

      console.log(`[EnhancedSoulNetPreloadService] Successfully created instant data with ${enhancedData.nodes.length} nodes and ${enhancedData.translations.size} translations`);
      return enhancedData;

    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] Error preloading instant data:', error);
      this.setTranslationState(translationCacheKey, { isTranslating: false, progress: 100 });
      return null;
    }
  }

  private static async getOrFetchGraphData(userId: string, timeRange: string): Promise<{ nodes: NodeData[], links: LinkData[] } | null> {
    const graphCacheKey = this.getGraphCacheKey(userId, timeRange);
    
    // Check graph cache
    const cachedGraphData = this.cache.get(graphCacheKey);
    if (cachedGraphData && (Date.now() - cachedGraphData.timestamp) < this.CACHE_DURATION) {
      console.log('[EnhancedSoulNetPreloadService] Using cached graph data');
      return { 
        nodes: cachedGraphData.data.nodes, 
        links: cachedGraphData.data.links 
      };
    }

    // Fetch fresh graph data
    console.log('[EnhancedSoulNetPreloadService] Fetching fresh graph data');
    const graphData = await this.fetchGraphData(userId, timeRange);
    
    if (graphData) {
      // Cache graph data (language-independent)
      this.cache.set(graphCacheKey, {
        data: {
          nodes: graphData.nodes,
          links: graphData.links,
          translations: new Map(),
          connectionPercentages: new Map(),
          nodeConnectionData: new Map(),
          translationProgress: 100,
          translationComplete: true
        },
        timestamp: Date.now(),
        userId,
        timeRange,
        language: 'graph' // Special marker
      });
    }

    return graphData;
  }

  private static async fetchGraphData(userId: string, timeRange: string): Promise<{ nodes: NodeData[], links: LinkData[] } | null> {
    try {
      const startDate = this.getStartDate(timeRange);
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('id, themeemotion, "refined text", "transcription text"')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[EnhancedSoulNetPreloadService] Error fetching journal entries:', error);
        return null;
      }

      if (!entries || entries.length === 0) {
        console.log('[EnhancedSoulNetPreloadService] No entries found');
        return { nodes: [], links: [] };
      }

      return this.processEntities(entries);
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] Error fetching graph data:', error);
      return null;
    }
  }

  private static calculateConnectionData(
    graphData: { nodes: NodeData[], links: LinkData[] },
    connectionPercentages: Map<string, number>,
    nodeConnectionData: Map<string, NodeConnectionData>
  ): void {
    console.log('[EnhancedSoulNetPreloadService] Calculating connection data');
    
    // Calculate node connection data
    const nodeConnections = new Map<string, { nodes: Set<string>, totalStrength: number }>();
    
    graphData.links.forEach(link => {
      // Source connections
      if (!nodeConnections.has(link.source)) {
        nodeConnections.set(link.source, { nodes: new Set(), totalStrength: 0 });
      }
      const sourceData = nodeConnections.get(link.source)!;
      sourceData.nodes.add(link.target);
      sourceData.totalStrength += link.value;
      
      // Target connections
      if (!nodeConnections.has(link.target)) {
        nodeConnections.set(link.target, { nodes: new Set(), totalStrength: 0 });
      }
      const targetData = nodeConnections.get(link.target)!;
      targetData.nodes.add(link.source);
      targetData.totalStrength += link.value;
    });

    // Convert to final format
    nodeConnections.forEach((data, nodeId) => {
      const connectedNodes = Array.from(data.nodes);
      nodeConnectionData.set(nodeId, {
        connectedNodes,
        totalStrength: data.totalStrength,
        averageStrength: connectedNodes.length > 0 ? data.totalStrength / connectedNodes.length : 0
      });
    });

    // Calculate connection percentages
    graphData.links.forEach(link => {
      const sourceData = nodeConnections.get(link.source);
      const targetData = nodeConnections.get(link.target);
      
      if (sourceData) {
        const sourcePercentage = Math.round((link.value / sourceData.totalStrength) * 100);
        connectionPercentages.set(`${link.source}-${link.target}`, sourcePercentage);
      }
      
      if (targetData) {
        const targetPercentage = Math.round((link.value / targetData.totalStrength) * 100);
        connectionPercentages.set(`${link.target}-${link.source}`, targetPercentage);
      }
    });

    console.log(`[EnhancedSoulNetPreloadService] Calculated ${nodeConnectionData.size} node connections and ${connectionPercentages.size} percentages`);
  }

  static getInstantData(cacheKey: string): CachedSoulNetData | null {
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached;
    }
    return null;
  }

  private static setInstantData(cacheKey: string, data: CachedSoulNetData): void {
    this.cache.set(cacheKey, data);
  }

  static getTranslationState(cacheKey: string): TranslationState {
    return this.translationStates.get(cacheKey) || { isTranslating: false, progress: 100 };
  }

  private static setTranslationState(cacheKey: string, state: TranslationState): void {
    this.translationStates.set(cacheKey, state);
  }

  static clearInstantCache(userId?: string): void {
    if (userId) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(userId));
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        this.translationStates.delete(key);
      });
      console.log(`[EnhancedSoulNetPreloadService] Cleared cache for user ${userId}`);
    } else {
      this.cache.clear();
      this.translationStates.clear();
      console.log('[EnhancedSoulNetPreloadService] Cleared all cache');
    }
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
    console.log("[EnhancedSoulNetPreloadService] Processing entities for", entries.length, "entries");
    
    const entityEmotionMap: Record<string, Record<string, number>> = {};
    
    entries.forEach(entry => {
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

    console.log("[EnhancedSoulNetPreloadService] Generating graph with", entityList.length, "entities");
    
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

    console.log("[EnhancedSoulNetPreloadService] Generated graph with", nodes.length, "nodes and", links.length, "links");
    return { nodes, links };
  }
}
