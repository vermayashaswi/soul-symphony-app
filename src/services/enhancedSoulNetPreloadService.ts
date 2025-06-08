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
}

interface CachedEnhancedData {
  data: EnhancedSoulNetData;
  timestamp: number;
  userId: string;
  timeRange: string;
  language: string;
  version: number; // Cache versioning
}

export class EnhancedSoulNetPreloadService {
  private static readonly CACHE_KEY = 'enhanced-soulnet-data';
  private static readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  private static readonly CACHE_VERSION = 2; // Increment when cache structure changes
  private static cache = new Map<string, CachedEnhancedData>();
  private static translationCoordinator = new Map<string, Promise<Map<string, string>>>();

  static async preloadInstantData(
    userId: string, 
    timeRange: string, 
    language: string
  ): Promise<EnhancedSoulNetData | null> {
    console.log(`[EnhancedSoulNetPreloadService] COORDINATED: Preloading instant data for ${userId}, ${timeRange}, ${language}`);
    
    const cacheKey = this.generateCacheKey(userId, timeRange, language);
    const cached = this.getInstantData(cacheKey);
    
    if (cached) {
      console.log(`[EnhancedSoulNetPreloadService] COORDINATED: Using cached instant data for ${cacheKey}`);
      return cached.data;
    }

    try {
      // Fetch raw journal data
      const startDate = this.getStartDate(timeRange);
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('id, entityemotion, "refined text", "transcription text"')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[EnhancedSoulNetPreloadService] Error fetching journal entries:', error);
        return null;
      }

      if (!entries || entries.length === 0) {
        console.log('[EnhancedSoulNetPreloadService] No entries found');
        const emptyData: EnhancedSoulNetData = {
          nodes: [], 
          links: [], 
          translations: new Map(), 
          connectionPercentages: new Map(),
          nodeConnectionData: new Map()
        };
        return emptyData;
      }

      console.log(`[EnhancedSoulNetPreloadService] COORDINATED: Found ${entries.length} entries for processing`);

      // Process the raw data
      const graphData = this.processEntities(entries);
      
      // COORDINATED TRANSLATION: Use translation coordinator to prevent race conditions
      const translations = await this.getCoordinatedTranslations(graphData.nodes, language, cacheKey);
      const connectionPercentages = new Map<string, number>();
      const nodeConnectionData = new Map<string, NodeConnectionData>();
      
      // Pre-calculate connection percentages and node connection data
      this.calculateConnectionPercentages(graphData, connectionPercentages);
      this.calculateNodeConnections(graphData, nodeConnectionData);

      const enhancedData: EnhancedSoulNetData = {
        nodes: graphData.nodes,
        links: graphData.links,
        translations,
        connectionPercentages,
        nodeConnectionData
      };

      // Cache the processed data with versioning
      this.setCachedData(cacheKey, {
        data: enhancedData,
        timestamp: Date.now(),
        userId,
        timeRange,
        language,
        version: this.CACHE_VERSION
      });

      console.log(`[EnhancedSoulNetPreloadService] COORDINATED: Successfully cached instant data for ${cacheKey} with ${enhancedData.nodes.length} nodes and ${enhancedData.translations.size} translations`);
      return enhancedData;
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] Error preloading instant data:', error);
      return null;
    }
  }

  // INSTANT ACCESS: Synchronous cache check
  static getInstantData(cacheKey: string): CachedEnhancedData | null {
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      console.log(`[EnhancedSoulNetPreloadService] INSTANT: Found valid cache for ${cacheKey}`);
      return cached;
    }
    
    // Try localStorage as fallback
    try {
      const storedData = localStorage.getItem(`${this.CACHE_KEY}-${cacheKey}`);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if (this.isCacheValid(parsed)) {
          // Convert Maps back from objects
          parsed.data.translations = new Map(Object.entries(parsed.data.translations || {}));
          parsed.data.connectionPercentages = new Map(Object.entries(parsed.data.connectionPercentages || {}));
          parsed.data.nodeConnectionData = new Map(
            Object.entries(parsed.data.nodeConnectionData || {}).map(([key, value]) => [key, value as NodeConnectionData])
          );
          this.cache.set(cacheKey, parsed);
          console.log(`[EnhancedSoulNetPreloadService] INSTANT: Found valid localStorage cache for ${cacheKey}`);
          return parsed;
        }
      }
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] Error loading from localStorage:', error);
    }
    
    console.log(`[EnhancedSoulNetPreloadService] INSTANT: No valid cache found for ${cacheKey}`);
    return null;
  }

  // COORDINATED TRANSLATION: Prevents race conditions
  private static async getCoordinatedTranslations(
    nodes: NodeData[], 
    language: string, 
    cacheKey: string
  ): Promise<Map<string, string>> {
    if (language === 'en') {
      const translations = new Map<string, string>();
      nodes.forEach(node => translations.set(node.id, node.id));
      return translations;
    }

    // Check if translation is already in progress for this cache key
    const existingTranslation = this.translationCoordinator.get(cacheKey);
    if (existingTranslation) {
      console.log(`[EnhancedSoulNetPreloadService] COORDINATED: Waiting for existing translation for ${cacheKey}`);
      return existingTranslation;
    }

    // Start new coordinated translation
    const translationPromise = this.performBatchTranslation(nodes, language);
    this.translationCoordinator.set(cacheKey, translationPromise);

    try {
      const result = await translationPromise;
      return result;
    } finally {
      // Clean up coordinator
      this.translationCoordinator.delete(cacheKey);
    }
  }

  private static async performBatchTranslation(nodes: NodeData[], language: string): Promise<Map<string, string>> {
    const translations = new Map<string, string>();
    const nodesToTranslate = [...new Set(nodes.map(node => node.id))]; // Remove duplicates
    
    console.log(`[EnhancedSoulNetPreloadService] COORDINATED: Batch translating ${nodesToTranslate.length} unique nodes`);
    
    try {
      const batchResults = await translationService.batchTranslate({
        texts: nodesToTranslate,
        targetLanguage: language
      });
      
      console.log(`[EnhancedSoulNetPreloadService] COORDINATED: Successfully translated ${batchResults.size}/${nodesToTranslate.length} nodes`);
      
      batchResults.forEach((translatedText, originalText) => {
        translations.set(originalText, translatedText);
        // SYNCHRONIZED: Cache in on-demand cache for immediate access
        onDemandTranslationCache.set(language, originalText, translatedText);
      });

      // Handle any missing translations
      nodesToTranslate.forEach(nodeId => {
        if (!translations.has(nodeId)) {
          console.warn(`[EnhancedSoulNetPreloadService] COORDINATED: No translation found for node: ${nodeId}, using original`);
          translations.set(nodeId, nodeId);
        }
      });
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] COORDINATED: Error during batch translation:', error);
      // Fallback: set original text for all nodes
      nodesToTranslate.forEach(nodeId => {
        translations.set(nodeId, nodeId);
      });
    }

    return translations;
  }

  private static calculateNodeConnections(
    graphData: { nodes: NodeData[], links: LinkData[] },
    nodeConnectionMap: Map<string, NodeConnectionData>
  ): void {
    console.log('[EnhancedSoulNetPreloadService] COORDINATED: Pre-calculating node connections');
    
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
      
      nodeConnectionMap.set(node.id, {
        connectedNodes,
        totalStrength,
        averageStrength
      });
    });

    console.log(`[EnhancedSoulNetPreloadService] COORDINATED: Pre-calculated connections for ${nodeConnectionMap.size} nodes`);
  }

  private static calculateConnectionPercentages(
    graphData: { nodes: NodeData[], links: LinkData[] },
    percentageMap: Map<string, number>
  ): void {
    console.log('[EnhancedSoulNetPreloadService] COORDINATED: Pre-calculating connection percentages');
    
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

    console.log(`[EnhancedSoulNetPreloadService] COORDINATED: Pre-calculated ${percentageMap.size} connection percentages`);
  }

  // SYNCHRONIZED CACHE KEY GENERATION
  private static generateCacheKey(userId: string, timeRange: string, language: string): string {
    return `${userId}-${timeRange}-${language}-v${this.CACHE_VERSION}`;
  }

  private static isCacheValid(cached: CachedEnhancedData): boolean {
    const isWithinDuration = (Date.now() - cached.timestamp) < this.CACHE_DURATION;
    const isCorrectVersion = cached.version === this.CACHE_VERSION;
    return isWithinDuration && isCorrectVersion;
  }

  private static setCachedData(cacheKey: string, data: CachedEnhancedData): void {
    this.cache.set(cacheKey, data);
    
    // Also store in localStorage
    try {
      const storableData = {
        ...data,
        data: {
          ...data.data,
          translations: Object.fromEntries(data.data.translations),
          connectionPercentages: Object.fromEntries(data.data.connectionPercentages),
          nodeConnectionData: Object.fromEntries(
            Array.from(data.data.nodeConnectionData.entries()).map(([key, value]) => [key, value])
          )
        }
      };
      localStorage.setItem(`${this.CACHE_KEY}-${cacheKey}`, JSON.stringify(storableData));
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] Error saving to localStorage:', error);
    }
  }

  // CLEAR CACHE WITH PROPER INVALIDATION
  static clearInstantCache(userId?: string): void {
    console.log(`[EnhancedSoulNetPreloadService] COORDINATED: Clearing instant cache for user ${userId || 'all users'}`);
    
    if (userId) {
      // Clear specific user's cache including all versions
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(userId));
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        localStorage.removeItem(`${this.CACHE_KEY}-${key}`);
      });
      
      // Clear translation coordinator for this user
      const coordinatorKeysToDelete = Array.from(this.translationCoordinator.keys()).filter(key => key.startsWith(userId));
      coordinatorKeysToDelete.forEach(key => {
        this.translationCoordinator.delete(key);
      });
      
      console.log(`[EnhancedSoulNetPreloadService] COORDINATED: Cleared instant cache for user ${userId}`);
    } else {
      // Clear all cache
      this.cache.clear();
      this.translationCoordinator.clear();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.CACHE_KEY)) {
          localStorage.removeItem(key);
        }
      });
      console.log('[EnhancedSoulNetPreloadService] COORDINATED: Cleared all instant cache');
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
    console.log("[EnhancedSoulNetPreloadService] COORDINATED: Processing entities for", entries.length, "entries");
    
    const entityEmotionMap: Record<string, Record<string, number>> = {};
    
    entries.forEach(entry => {
      if (!entry.entityemotion) return;
      
      Object.entries(entry.entityemotion).forEach(([entity, emotions]) => {
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

    console.log("[EnhancedSoulNetPreloadService] COORDINATED: Generating graph with", entityList.length, "entities");
    
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

    console.log("[EnhancedSoulNetPreloadService] COORDINATED: Generated graph with", nodes.length, "nodes and", links.length, "links");
    return { nodes, links };
  }
}
