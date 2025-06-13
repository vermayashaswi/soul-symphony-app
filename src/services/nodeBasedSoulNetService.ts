
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

interface GraphDataCache {
  nodes: NodeData[];
  links: LinkData[];
  connectionPercentages: Map<string, number>;
  nodeConnectionData: Map<string, NodeConnectionData>;
  timestamp: number;
  userId: string;
  timeRange: string;
}

interface NodeBasedSoulNetData {
  nodes: NodeData[];
  links: LinkData[];
  translations: Map<string, string>;
  connectionPercentages: Map<string, number>;
  nodeConnectionData: Map<string, NodeConnectionData>;
  translationProgress: number;
  isTranslating: boolean;
}

export class NodeBasedSoulNetService {
  private static readonly GRAPH_CACHE_KEY = 'soulnet-graph-cache';
  private static readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  private static readonly CACHE_VERSION = 1;
  
  private static graphCache = new Map<string, GraphDataCache>();
  private static translationStates = new Map<string, {
    isTranslating: boolean;
    progress: number;
    startedAt: number;
  }>();

  // NODE-BASED: Get data with persistent node translations
  static async getNodeBasedData(
    userId: string,
    timeRange: string,
    language: string
  ): Promise<NodeBasedSoulNetData | null> {
    console.log(`[NodeBasedSoulNetService] Getting node-based data for ${userId}, ${timeRange}, ${language}`);

    try {
      // Step 1: Get graph data (time-range dependent)
      const graphData = await this.getGraphData(userId, timeRange);
      if (!graphData) {
        return null;
      }

      // Step 2: Get node translations (node-ID based, persistent across time ranges)
      const nodeIds = [...new Set(graphData.nodes.map(node => node.id))];
      const translations = await this.getNodeTranslations(nodeIds, language);

      // Step 3: Calculate translation progress
      const translationProgress = language === 'en' ? 100 : 
        Math.round((translations.size / nodeIds.length) * 100);

      const isTranslating = this.getTranslationState(`${userId}-${language}`).isTranslating;

      return {
        nodes: graphData.nodes,
        links: graphData.links,
        translations,
        connectionPercentages: graphData.connectionPercentages,
        nodeConnectionData: graphData.nodeConnectionData,
        translationProgress,
        isTranslating
      };
    } catch (error) {
      console.error('[NodeBasedSoulNetService] Error getting node-based data:', error);
      return null;
    }
  }

  // NODE-BASED: Get or fetch graph data (cached by time range only)
  private static async getGraphData(userId: string, timeRange: string): Promise<GraphDataCache | null> {
    const graphCacheKey = `${userId}-${timeRange}`;
    
    // Check memory cache
    const cached = this.graphCache.get(graphCacheKey);
    if (cached && this.isGraphCacheValid(cached)) {
      console.log(`[NodeBasedSoulNetService] Using cached graph data for ${graphCacheKey}`);
      return cached;
    }

    // Check localStorage
    const storedGraph = this.getStoredGraphData(graphCacheKey);
    if (storedGraph) {
      this.graphCache.set(graphCacheKey, storedGraph);
      console.log(`[NodeBasedSoulNetService] Loaded graph data from storage for ${graphCacheKey}`);
      return storedGraph;
    }

    // Fetch fresh graph data
    console.log(`[NodeBasedSoulNetService] Fetching fresh graph data for ${graphCacheKey}`);
    const freshGraphData = await this.fetchGraphData(userId, timeRange);
    if (freshGraphData) {
      this.cacheGraphData(graphCacheKey, freshGraphData);
    }

    return freshGraphData;
  }

  // NODE-BASED: Get persistent node translations
  private static async getNodeTranslations(nodeIds: string[], language: string): Promise<Map<string, string>> {
    const translations = new Map<string, string>();

    if (language === 'en') {
      nodeIds.forEach(nodeId => translations.set(nodeId, nodeId));
      return translations;
    }

    console.log(`[NodeBasedSoulNetService] Getting persistent translations for ${nodeIds.length} nodes in ${language}`);

    // Get all cached translations
    const cachedTranslations = await NodeTranslationCacheService.getBatchCachedTranslations(nodeIds, language);
    console.log(`[NodeBasedSoulNetService] Found ${cachedTranslations.size} cached translations`);

    // Add cached translations
    cachedTranslations.forEach((translation, nodeId) => {
      translations.set(nodeId, translation);
    });

    // Identify nodes needing translation
    const uncachedNodes = nodeIds.filter(nodeId => !translations.has(nodeId));
    
    if (uncachedNodes.length > 0) {
      console.log(`[NodeBasedSoulNetService] Need to translate ${uncachedNodes.length} nodes`);
      
      // Set translation state
      const stateKey = `${language}`;
      this.translationStates.set(stateKey, {
        isTranslating: true,
        progress: Math.round((translations.size / nodeIds.length) * 100),
        startedAt: Date.now()
      });

      // Perform batch translation
      try {
        const batchResults = await translationService.batchTranslate({
          texts: uncachedNodes,
          targetLanguage: language,
          sourceLanguage: 'en'
        });

        // Process results
        const newTranslations = new Map<string, string>();
        uncachedNodes.forEach(nodeId => {
          const translatedText = batchResults.get(nodeId);
          if (translatedText && translatedText.trim()) {
            translations.set(nodeId, translatedText);
            newTranslations.set(nodeId, translatedText);
          } else {
            translations.set(nodeId, nodeId); // Fallback to original
          }
        });

        // Cache new translations
        if (newTranslations.size > 0) {
          await NodeTranslationCacheService.setBatchCachedTranslations(newTranslations, language);
          console.log(`[NodeBasedSoulNetService] Cached ${newTranslations.size} new translations`);
        }

      } catch (error) {
        console.error('[NodeBasedSoulNetService] Error during batch translation:', error);
        // Use original text for failed translations
        uncachedNodes.forEach(nodeId => {
          if (!translations.has(nodeId)) {
            translations.set(nodeId, nodeId);
          }
        });
      }

      // Clear translation state
      this.translationStates.set(stateKey, {
        isTranslating: false,
        progress: 100,
        startedAt: 0
      });
    }

    console.log(`[NodeBasedSoulNetService] Final translations: ${translations.size}/${nodeIds.length}`);
    return translations;
  }

  // Fetch graph data from database
  private static async fetchGraphData(userId: string, timeRange: string): Promise<GraphDataCache | null> {
    try {
      const startDate = this.getStartDate(timeRange);
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('id, themeemotion, "refined text", "transcription text"')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[NodeBasedSoulNetService] Error fetching entries:', error);
        return null;
      }

      if (!entries || entries.length === 0) {
        console.log('[NodeBasedSoulNetService] No entries found');
        return {
          nodes: [],
          links: [],
          connectionPercentages: new Map(),
          nodeConnectionData: new Map(),
          timestamp: Date.now(),
          userId,
          timeRange
        };
      }

      console.log(`[NodeBasedSoulNetService] Processing ${entries.length} entries`);
      const graphData = this.processEntities(entries);
      
      const connectionPercentages = new Map<string, number>();
      const nodeConnectionData = new Map<string, NodeConnectionData>();
      
      this.calculateConnectionPercentages(graphData, connectionPercentages);
      this.calculateNodeConnections(graphData, nodeConnectionData);

      return {
        nodes: graphData.nodes,
        links: graphData.links,
        connectionPercentages,
        nodeConnectionData,
        timestamp: Date.now(),
        userId,
        timeRange
      };
    } catch (error) {
      console.error('[NodeBasedSoulNetService] Error fetching graph data:', error);
      return null;
    }
  }

  // Cache management
  private static cacheGraphData(cacheKey: string, data: GraphDataCache): void {
    this.graphCache.set(cacheKey, data);
    
    try {
      const storableData = {
        ...data,
        connectionPercentages: Object.fromEntries(data.connectionPercentages),
        nodeConnectionData: Object.fromEntries(
          Array.from(data.nodeConnectionData.entries()).map(([key, value]) => [key, value])
        )
      };
      localStorage.setItem(`${this.GRAPH_CACHE_KEY}-${cacheKey}`, JSON.stringify(storableData));
    } catch (error) {
      console.error('[NodeBasedSoulNetService] Error saving graph cache:', error);
    }
  }

  private static getStoredGraphData(cacheKey: string): GraphDataCache | null {
    try {
      const stored = localStorage.getItem(`${this.GRAPH_CACHE_KEY}-${cacheKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (this.isGraphCacheValid(parsed)) {
          // Convert objects back to Maps
          parsed.connectionPercentages = new Map(Object.entries(parsed.connectionPercentages || {}));
          parsed.nodeConnectionData = new Map(
            Object.entries(parsed.nodeConnectionData || {}).map(([key, value]) => [key, value as NodeConnectionData])
          );
          return parsed;
        }
      }
    } catch (error) {
      console.error('[NodeBasedSoulNetService] Error loading stored graph data:', error);
    }
    return null;
  }

  private static isGraphCacheValid(cache: GraphDataCache): boolean {
    return (Date.now() - cache.timestamp) < this.CACHE_DURATION;
  }

  // Translation state management
  static getTranslationState(stateKey: string) {
    const state = this.translationStates.get(stateKey);
    if (!state) {
      return { isTranslating: false, progress: 100, startedAt: 0 };
    }

    // Check for timeout
    if (state.isTranslating && (Date.now() - state.startedAt) > 30000) {
      console.log(`[NodeBasedSoulNetService] Translation timeout for ${stateKey}`);
      this.translationStates.delete(stateKey);
      return { isTranslating: false, progress: 100, startedAt: 0 };
    }

    return state;
  }

  // Clear caches
  static clearGraphCache(userId?: string): void {
    if (userId) {
      const keysToDelete = Array.from(this.graphCache.keys()).filter(key => key.startsWith(userId));
      keysToDelete.forEach(key => {
        this.graphCache.delete(key);
        localStorage.removeItem(`${this.GRAPH_CACHE_KEY}-${key}`);
      });
      console.log(`[NodeBasedSoulNetService] Cleared graph cache for user ${userId}`);
    } else {
      this.graphCache.clear();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.GRAPH_CACHE_KEY)) {
          localStorage.removeItem(key);
        }
      });
      console.log('[NodeBasedSoulNetService] Cleared all graph cache');
    }
  }

  static clearTranslationStates(): void {
    this.translationStates.clear();
    console.log('[NodeBasedSoulNetService] Cleared all translation states');
  }

  // Helper methods
  private static calculateConnectionPercentages(
    graphData: { nodes: NodeData[], links: LinkData[] },
    percentageMap: Map<string, number>
  ): void {
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

    console.log(`[NodeBasedSoulNetService] Calculated ${percentageMap.size} connection percentages`);
  }

  private static calculateNodeConnections(
    graphData: { nodes: NodeData[], links: LinkData[] },
    nodeConnectionMap: Map<string, NodeConnectionData>
  ): void {
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

    entityList.forEach((entity, entityIndex) => {
      entityNodes.add(entity);
      const entityAngle = (entityIndex / entityList.length) * Math.PI * 2;
      const entityRadius = ENTITY_LAYER_RADIUS;
      const entityX = Math.cos(entityAngle) * entityRadius;
      
      const getEntityYPosition = (index: number): number => {
        const position = index % 8;
        switch (position) {
          case 0: return 2;
          case 1: return -2;
          case 2: return 2.25;
          case 3: return -2.25;
          case 4: return 2.5;
          case 5: return -2.5;
          case 6: return 2;
          case 7: return -2;
          default: return 2;
        }
      };
      
      const entityY = getEntityYPosition(entityIndex);
      const entityZ = Math.sin(entityAngle) * entityRadius;
      
      nodes.push({
        id: entity,
        type: 'entity',
        value: 1,
        color: '#22c55e',
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
      
      const getEmotionYPosition = (index: number): number => {
        const position = index % 6;
        switch (position) {
          case 0: return 7;
          case 1: return -7;
          case 2: return 9;
          case 3: return -9;
          case 4: return 11;
          case 5: return -11;
          default: return 7;
        }
      };
      
      const emotionY = getEmotionYPosition(emotionIndex);
      const emotionZ = Math.sin(emotionAngle) * emotionRadius;
      
      nodes.push({
        id: emotion,
        type: 'emotion',
        value: 0.8,
        color: '#f59e0b',
        position: [emotionX, emotionY, emotionZ]
      });
    });

    console.log(`[NodeBasedSoulNetService] Generated graph with ${nodes.length} nodes and ${links.length} links`);
    return { nodes, links };
  }
}
