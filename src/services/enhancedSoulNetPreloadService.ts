import { supabase } from '@/integrations/supabase/client';
import { NodeTranslationCacheService } from '@/services/nodeTranslationCacheService';

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

interface ProcessedInstantData {
  nodes: NodeData[];
  links: LinkData[];
  translations: Map<string, string>;
  connectionPercentages: Map<string, number>;
  nodeConnectionData: Map<string, NodeConnectionData>;
  translationProgress: number;
  translationComplete: boolean;
}

interface CachedInstantData {
  data: ProcessedInstantData;
  timestamp: number;
  userId: string;
  timeRange: string;
  language: string;
}

interface TranslationService {
  batchTranslate: (options: { texts: string[]; targetLanguage: string }) => Promise<Map<string, string>>;
}

export class EnhancedSoulNetPreloadService {
  private static readonly CACHE_KEY = 'enhanced-soulnet-instant-data';
  private static readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  private static cache = new Map<string, CachedInstantData>();
  private static appLevelTranslationService: TranslationService | null = null;

  // APP-LEVEL: Set translation service for coordinated translations
  static setAppLevelTranslationService(translationService: TranslationService): void {
    this.appLevelTranslationService = translationService;
    console.log('[EnhancedSoulNetPreloadService] APP-LEVEL: Translation service configured');
  }

  static async preloadInstantData(
    userId: string,
    timeRange: string,
    language: string
  ): Promise<ProcessedInstantData | null> {
    console.log(`[EnhancedSoulNetPreloadService] ENHANCED: Preloading instant data for ${userId}, ${timeRange}, ${language}`);
    
    const cacheKey = `${userId}-${timeRange}-${language}`;
    const cached = this.getInstantData(cacheKey);
    
    if (cached && cached.data.translationComplete) {
      console.log(`[EnhancedSoulNetPreloadService] ENHANCED: Using complete cached data for ${cacheKey}`);
      return cached.data;
    }

    try {
      // STEP 1: Fetch raw data
      const rawData = await this.fetchRawData(userId, timeRange);
      if (!rawData || rawData.entries.length === 0) {
        console.log('[EnhancedSoulNetPreloadService] ENHANCED: No raw data found');
        return { 
          nodes: [], 
          links: [], 
          translations: new Map(), 
          connectionPercentages: new Map(),
          nodeConnectionData: new Map(),
          translationProgress: 100,
          translationComplete: true
        };
      }

      // STEP 2: Process graph structure
      const processedGraph = this.processGraphData(rawData.entries);
      
      // STEP 3: Calculate connection data
      const connectionPercentages = new Map<string, number>();
      const nodeConnectionData = new Map<string, NodeConnectionData>();
      this.calculateConnections(processedGraph, connectionPercentages, nodeConnectionData);

      // STEP 4: Handle translations efficiently
      const nodeIds = [...new Set(processedGraph.nodes.map(node => node.id))];
      const translations = new Map<string, string>();
      let translationProgress = 0;
      let translationComplete = false;

      if (language === 'en') {
        // English - no translation needed
        nodeIds.forEach(nodeId => translations.set(nodeId, nodeId));
        translationProgress = 100;
        translationComplete = true;
        console.log('[EnhancedSoulNetPreloadService] ENHANCED: English language, no translation needed');
      } else {
        // ENHANCED: Check if batch already completed
        const batchAlreadyCompleted = NodeTranslationCacheService.isBatchCompleted(nodeIds, language);
        
        if (batchAlreadyCompleted) {
          console.log(`[EnhancedSoulNetPreloadService] ENHANCED: Batch already completed, loading from cache`);
          
          // Load all from cache
          nodeIds.forEach(nodeId => {
            const cached = NodeTranslationCacheService.getCachedTranslation(nodeId, language);
            translations.set(nodeId, cached || nodeId);
          });
          
          translationProgress = 100;
          translationComplete = true;
        } else {
          console.log(`[EnhancedSoulNetPreloadService] ENHANCED: Starting coordinated batch translation`);
          
          try {
            // Use coordinated translation service
            const batchResults = await NodeTranslationCacheService.batchTranslateNodes(nodeIds, language);
            
            batchResults.forEach((translatedText, originalText) => {
              translations.set(originalText, translatedText);
            });
            
            translationProgress = 100;
            translationComplete = true;
            
            console.log(`[EnhancedSoulNetPreloadService] ENHANCED: Coordinated translation completed for ${nodeIds.length} nodes`);
          } catch (error) {
            console.error('[EnhancedSoulNetPreloadService] ENHANCED: Coordinated translation failed:', error);
            
            // Fallback: use original text
            nodeIds.forEach(nodeId => translations.set(nodeId, nodeId));
            translationProgress = 100;
            translationComplete = true;
          }
        }
      }

      const processedData: ProcessedInstantData = {
        nodes: processedGraph.nodes,
        links: processedGraph.links,
        translations,
        connectionPercentages,
        nodeConnectionData,
        translationProgress,
        translationComplete
      };

      // Cache the result
      this.setInstantData(cacheKey, {
        data: processedData,
        timestamp: Date.now(),
        userId,
        timeRange,
        language
      });

      console.log(`[EnhancedSoulNetPreloadService] ENHANCED: Successfully processed ${processedData.nodes.length} nodes with ${processedData.translations.size} translations`);
      return processedData;

    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] ENHANCED: Error preloading instant data:', error);
      return null;
    }
  }

  // Get cached instant data
  static getInstantData(cacheKey: string): CachedInstantData | null {
    const memoryCache = this.cache.get(cacheKey);
    if (memoryCache && (Date.now() - memoryCache.timestamp) < this.CACHE_DURATION) {
      return memoryCache;
    }

    // Try localStorage
    try {
      const storedData = localStorage.getItem(`${this.CACHE_KEY}-${cacheKey}`);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if ((Date.now() - parsed.timestamp) < this.CACHE_DURATION) {
          // Convert back to Maps
          parsed.data.translations = new Map(Object.entries(parsed.data.translations || {}));
          parsed.data.connectionPercentages = new Map(Object.entries(parsed.data.connectionPercentages || {}));
          parsed.data.nodeConnectionData = new Map(Object.entries(parsed.data.nodeConnectionData || {}));
          
          this.cache.set(cacheKey, parsed);
          return parsed;
        }
      }
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] Error loading from localStorage:', error);
    }

    return null;
  }

  // Set cached instant data
  private static setInstantData(cacheKey: string, data: CachedInstantData): void {
    this.cache.set(cacheKey, data);
    
    try {
      const storableData = {
        ...data,
        data: {
          ...data.data,
          translations: Object.fromEntries(data.data.translations),
          connectionPercentages: Object.fromEntries(data.data.connectionPercentages),
          nodeConnectionData: Object.fromEntries(data.data.nodeConnectionData)
        }
      };
      localStorage.setItem(`${this.CACHE_KEY}-${cacheKey}`, JSON.stringify(storableData));
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] Error saving to localStorage:', error);
    }
  }

  // ENHANCED: Smart cache invalidation - only clear other time ranges
  static clearTimeRangeCache(userId: string, keepTimeRange: string, keepLanguage: string): void {
    console.log(`[EnhancedSoulNetPreloadService] ENHANCED: Smart cache clearing - keeping ${keepTimeRange} for ${keepLanguage}`);
    
    const keysToDelete: string[] = [];
    
    this.cache.forEach((cached, key) => {
      if (cached.userId === userId) {
        // Only clear if different time range OR different language
        if (cached.timeRange !== keepTimeRange || cached.language !== keepLanguage) {
          keysToDelete.push(key);
        }
      }
    });
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      localStorage.removeItem(`${this.CACHE_KEY}-${key}`);
    });
    
    console.log(`[EnhancedSoulNetPreloadService] ENHANCED: Cleared ${keysToDelete.length} cache entries, keeping current`);
  }

  // Force invalidate specific cache
  static forceInvalidateCache(userId: string, timeRange: string, language: string): void {
    const cacheKey = `${userId}-${timeRange}-${language}`;
    this.cache.delete(cacheKey);
    localStorage.removeItem(`${this.CACHE_KEY}-${cacheKey}`);
    console.log(`[EnhancedSoulNetPreloadService] ENHANCED: Force invalidated cache for ${cacheKey}`);
  }

  // Clear all instant cache
  static clearInstantCache(): void {
    this.cache.clear();
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(this.CACHE_KEY)) {
        localStorage.removeItem(key);
      }
    });
    console.log('[EnhancedSoulNetPreloadService] ENHANCED: Cleared all instant cache');
  }

  // Fetch raw data from database
  private static async fetchRawData(userId: string, timeRange: string): Promise<{ entries: any[] } | null> {
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

    return { entries: entries || [] };
  }

  // Process raw entries into graph data
  private static processGraphData(entries: any[]): { nodes: NodeData[], links: LinkData[] } {
    console.log("[EnhancedSoulNetPreloadService] Processing graph data for", entries.length, "entries");
    
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

  // Generate graph from entity-emotion mapping
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

  // Calculate connection percentages and node data
  private static calculateConnections(
    graphData: { nodes: NodeData[], links: LinkData[] },
    connectionPercentages: Map<string, number>,
    nodeConnectionData: Map<string, NodeConnectionData>
  ): void {
    console.log('[EnhancedSoulNetPreloadService] Calculating connection data');
    
    // Calculate connection percentages
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
      connectionPercentages.set(`${link.source}-${link.target}`, sourcePercentage);
      
      const targetPercentage = Math.round((link.value / targetTotal) * 100);
      connectionPercentages.set(`${link.target}-${link.source}`, targetPercentage);
    });

    // Calculate node connection data
    graphData.nodes.forEach(node => {
      const connectedNodes: string[] = [];
      let totalStrength = 0;
      
      graphData.links.forEach(link => {
        if (link.source === node.id) {
          connectedNodes.push(link.target);
          totalStrength += link.value;
        } else if (link.target === node.id) {
          connectedNodes.push(link.source);
          totalStrength += link.value;
        }
      });
      
      const averageStrength = connectedNodes.length > 0 ? totalStrength / connectedNodes.length : 0;
      
      nodeConnectionData.set(node.id, {
        connectedNodes,
        totalStrength,
        averageStrength
      });
    });

    console.log(`[EnhancedSoulNetPreloadService] Calculated ${connectionPercentages.size} connection percentages and ${nodeConnectionData.size} node data entries`);
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
}
