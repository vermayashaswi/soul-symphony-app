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

interface AtomicSoulNetData {
  nodes: NodeData[];
  links: LinkData[];
  translations: Map<string, string>;
  connectionPercentages: Map<string, number>;
  nodeConnectionData: Map<string, NodeConnectionData>;
  translationProgress: number;
  isTranslating: boolean;
  translationComplete: boolean;
}

interface GraphCache {
  nodes: NodeData[];
  links: LinkData[];
  connectionPercentages: Map<string, number>;
  nodeConnectionData: Map<string, NodeConnectionData>;
  timestamp: number;
}

export class AtomicSoulNetService {
  private static readonly GRAPH_CACHE_KEY = 'atomic-soulnet-graph';
  private static readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  
  private static graphCache = new Map<string, GraphCache>();
  private static translationStates = new Map<string, {
    isTranslating: boolean;
    progress: number;
    complete: boolean;
    startedAt: number;
  }>();

  // ATOMIC: Single entry point for getting SoulNet data
  static async getAtomicData(
    userId: string,
    timeRange: string,
    language: string
  ): Promise<AtomicSoulNetData | null> {
    console.log(`[AtomicSoulNetService] ATOMIC: Getting data for ${userId}, ${timeRange}, ${language}`);

    try {
      // Step 1: Get graph data (language-independent)
      const graphData = await this.getGraphData(userId, timeRange);
      if (!graphData) {
        return null;
      }

      // Step 2: Handle translations atomically
      const translationResult = await this.getAtomicTranslations(
        [...new Set(graphData.nodes.map(node => node.id))],
        language,
        userId
      );

      return {
        nodes: graphData.nodes,
        links: graphData.links,
        translations: translationResult.translations,
        connectionPercentages: graphData.connectionPercentages,
        nodeConnectionData: graphData.nodeConnectionData,
        translationProgress: translationResult.progress,
        isTranslating: translationResult.isTranslating,
        translationComplete: translationResult.complete
      };
    } catch (error) {
      console.error('[AtomicSoulNetService] ATOMIC: Error getting data:', error);
      return null;
    }
  }

  // ATOMIC: Unified translation handling
  private static async getAtomicTranslations(
    nodeIds: string[], 
    language: string, 
    userId: string
  ): Promise<{ translations: Map<string, string>, progress: number, isTranslating: boolean, complete: boolean }> {
    const translations = new Map<string, string>();
    const stateKey = `${userId}-${language}`;

    if (language === 'en') {
      nodeIds.forEach(nodeId => translations.set(nodeId, nodeId));
      this.setTranslationState(stateKey, { isTranslating: false, progress: 100, complete: true });
      return { translations, progress: 100, isTranslating: false, complete: true };
    }

    console.log(`[AtomicSoulNetService] ATOMIC: Getting translations for ${nodeIds.length} nodes in ${language}`);

    // Get all cached translations
    const cachedTranslations = await NodeTranslationCacheService.getBatchCachedTranslations(nodeIds, language);
    cachedTranslations.forEach((translation, nodeId) => {
      translations.set(nodeId, translation);
    });

    const currentProgress = Math.round((translations.size / nodeIds.length) * 100);
    const uncachedNodes = nodeIds.filter(nodeId => !translations.has(nodeId));
    
    if (uncachedNodes.length === 0) {
      console.log('[AtomicSoulNetService] ATOMIC: All translations cached, marking complete');
      this.setTranslationState(stateKey, { isTranslating: false, progress: 100, complete: true });
      return { translations, progress: 100, isTranslating: false, complete: true };
    }

    console.log(`[AtomicSoulNetService] ATOMIC: Need to translate ${uncachedNodes.length} nodes`);
    
    // Set translating state
    this.setTranslationState(stateKey, { isTranslating: true, progress: currentProgress, complete: false });

    // Start background translation
    this.performAtomicTranslation(uncachedNodes, language, stateKey).catch(error => {
      console.error('[AtomicSoulNetService] ATOMIC: Background translation error:', error);
      this.setTranslationState(stateKey, { isTranslating: false, progress: 100, complete: false });
    });

    return { 
      translations, 
      progress: currentProgress, 
      isTranslating: true, 
      complete: false 
    };
  }

  // ATOMIC: Background translation with completion signaling
  private static async performAtomicTranslation(
    nodeIds: string[], 
    language: string, 
    stateKey: string
  ): Promise<void> {
    try {
      console.log(`[AtomicSoulNetService] ATOMIC: Starting background translation for ${nodeIds.length} nodes`);

      const batchResults = await translationService.batchTranslate({
        texts: nodeIds,
        targetLanguage: language,
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

      // Cache new translations
      if (newTranslations.size > 0) {
        await NodeTranslationCacheService.setBatchCachedTranslations(newTranslations, language);
        console.log(`[AtomicSoulNetService] ATOMIC: Cached ${newTranslations.size} new translations`);
      }

      // Mark translation as complete
      this.setTranslationState(stateKey, { isTranslating: false, progress: 100, complete: true });

      console.log('[AtomicSoulNetService] ATOMIC: Translation completed');

      // Emit completion event
      window.dispatchEvent(new CustomEvent('atomicSoulNetTranslationComplete', {
        detail: { language, nodeCount: nodeIds.length, stateKey }
      }));

    } catch (error) {
      console.error('[AtomicSoulNetService] ATOMIC: Background translation failed:', error);
      this.setTranslationState(stateKey, { isTranslating: false, progress: 100, complete: false });
    }
  }

  // ENHANCED: Batch translation and caching for comprehensive pre-translation
  static async batchTranslateAndCacheNodes(
    nodeIds: string[], 
    language: string, 
    userId: string,
    progressCallback?: (progress: number) => void
  ): Promise<Map<string, string>> {
    const translations = new Map<string, string>();
    
    if (language === 'en') {
      nodeIds.forEach(nodeId => translations.set(nodeId, nodeId));
      progressCallback?.(100);
      return translations;
    }

    console.log(`[AtomicSoulNetService] ENHANCED: Batch translating ${nodeIds.length} nodes for comprehensive caching`);

    try {
      // Check existing cache first
      const cachedTranslations = await NodeTranslationCacheService.getBatchCachedTranslations(nodeIds, language);
      cachedTranslations.forEach((translation, nodeId) => {
        translations.set(nodeId, translation);
      });

      const uncachedNodes = nodeIds.filter(nodeId => !translations.has(nodeId));
      
      if (uncachedNodes.length === 0) {
        console.log('[AtomicSoulNetService] ENHANCED: All nodes already cached');
        progressCallback?.(100);
        return translations;
      }

      console.log(`[AtomicSoulNetService] ENHANCED: Translating ${uncachedNodes.length} uncached nodes`);

      // Report initial progress based on cached translations
      const initialProgress = Math.round((translations.size / nodeIds.length) * 100);
      progressCallback?.(initialProgress);

      // Translate uncached nodes in batches
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < uncachedNodes.length; i += batchSize) {
        batches.push(uncachedNodes.slice(i, i + batchSize));
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
          
          // Report progress
          const currentProgress = Math.round((translations.size / nodeIds.length) * 100);
          progressCallback?.(currentProgress);
          
          console.log(`[AtomicSoulNetService] ENHANCED: Completed batch ${i + 1}/${batches.length}, progress: ${currentProgress}%`);
          
        } catch (batchError) {
          console.error(`[AtomicSoulNetService] ENHANCED: Error translating batch ${i + 1}:`, batchError);
          
          // Set fallback translations for failed batch
          batch.forEach(nodeId => {
            if (!translations.has(nodeId)) {
              translations.set(nodeId, nodeId);
            }
          });
        }
      }

      progressCallback?.(100);
      console.log(`[AtomicSoulNetService] ENHANCED: Batch translation completed, ${translations.size} total translations`);
      
      return translations;
      
    } catch (error) {
      console.error('[AtomicSoulNetService] ENHANCED: Error in batch translation:', error);
      
      // Fallback: set all nodes to themselves
      nodeIds.forEach(nodeId => {
        if (!translations.has(nodeId)) {
          translations.set(nodeId, nodeId);
        }
      });
      
      progressCallback?.(100);
      return translations;
    }
  }

  // ... keep existing code (translation state management, graph data methods, helper methods)

  static getTranslationState(stateKey: string) {
    const state = this.translationStates.get(stateKey);
    if (!state) {
      return { isTranslating: false, progress: 100, complete: true, startedAt: 0 };
    }

    // Check for timeout (30 seconds)
    if (state.isTranslating && (Date.now() - state.startedAt) > 30000) {
      console.log(`[AtomicSoulNetService] ATOMIC: Translation timeout for ${stateKey}`);
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

  // Graph data management (unchanged from original service)
  private static async getGraphData(userId: string, timeRange: string): Promise<GraphCache | null> {
    const graphCacheKey = `${userId}-${timeRange}`;
    
    const cached = this.graphCache.get(graphCacheKey);
    if (cached && this.isGraphCacheValid(cached)) {
      console.log(`[AtomicSoulNetService] ATOMIC: Using cached graph data for ${graphCacheKey}`);
      return cached;
    }

    const storedGraph = this.getStoredGraphData(graphCacheKey);
    if (storedGraph) {
      this.graphCache.set(graphCacheKey, storedGraph);
      console.log(`[AtomicSoulNetService] ATOMIC: Loaded graph data from storage for ${graphCacheKey}`);
      return storedGraph;
    }

    console.log(`[AtomicSoulNetService] ATOMIC: Fetching fresh graph data for ${graphCacheKey}`);
    const freshGraphData = await this.fetchGraphData(userId, timeRange);
    if (freshGraphData) {
      this.cacheGraphData(graphCacheKey, freshGraphData);
    }

    return freshGraphData;
  }

  private static async fetchGraphData(userId: string, timeRange: string): Promise<GraphCache | null> {
    try {
      const startDate = this.getStartDate(timeRange);
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('id, themeemotion, "refined text", "transcription text"')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[AtomicSoulNetService] ATOMIC: Error fetching entries:', error);
        return null;
      }

      if (!entries || entries.length === 0) {
        console.log('[AtomicSoulNetService] ATOMIC: No entries found');
        return {
          nodes: [],
          links: [],
          connectionPercentages: new Map(),
          nodeConnectionData: new Map(),
          timestamp: Date.now()
        };
      }

      console.log(`[AtomicSoulNetService] ATOMIC: Processing ${entries.length} entries`);
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
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[AtomicSoulNetService] ATOMIC: Error fetching graph data:', error);
      return null;
    }
  }

  // Helper methods remain the same
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

  private static cacheGraphData(cacheKey: string, data: GraphCache): void {
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
      console.error('[AtomicSoulNetService] ATOMIC: Error saving graph cache:', error);
    }
  }

  private static getStoredGraphData(cacheKey: string): GraphCache | null {
    try {
      const stored = localStorage.getItem(`${this.GRAPH_CACHE_KEY}-${cacheKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (this.isGraphCacheValid(parsed)) {
          parsed.connectionPercentages = new Map(Object.entries(parsed.connectionPercentages || {}));
          parsed.nodeConnectionData = new Map(
            Object.entries(parsed.nodeConnectionData || {}).map(([key, value]) => [key, value as NodeConnectionData])
          );
          return parsed;
        }
      }
    } catch (error) {
      console.error('[AtomicSoulNetService] ATOMIC: Error loading stored graph data:', error);
    }
    return null;
  }

  private static isGraphCacheValid(cache: GraphCache): boolean {
    return (Date.now() - cache.timestamp) < this.CACHE_DURATION;
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

    console.log(`[AtomicSoulNetService] ATOMIC: Generated graph with ${nodes.length} nodes and ${links.length} links`);
    return { nodes, links };
  }

  // Clear caches
  static clearCache(userId?: string): void {
    if (userId) {
      const keysToDelete = Array.from(this.graphCache.keys()).filter(key => key.startsWith(userId));
      keysToDelete.forEach(key => {
        this.graphCache.delete(key);
        localStorage.removeItem(`${this.GRAPH_CACHE_KEY}-${key}`);
      });
      console.log(`[AtomicSoulNetService] ATOMIC: Cleared cache for user ${userId}`);
    } else {
      this.graphCache.clear();
      this.translationStates.clear();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.GRAPH_CACHE_KEY)) {
          localStorage.removeItem(key);
        }
      });
      console.log('[AtomicSoulNetService] ATOMIC: Cleared all cache');
    }
  }
}
