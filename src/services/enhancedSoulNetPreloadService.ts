
import { supabase } from '@/integrations/supabase/client';
import { translationService } from '@/services/translationService';

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

interface InstantSoulNetData {
  nodes: NodeData[];
  links: LinkData[];
  translations: Map<string, string>;
  connectionPercentages: Map<string, number>;
  nodeConnectionData: Map<string, NodeConnectionData>;
}

interface CachedInstantData {
  data: InstantSoulNetData;
  timestamp: number;
  userId: string;
  timeRange: string;
  language: string;
}

export class EnhancedSoulNetPreloadService {
  private static readonly CACHE_KEY = 'enhanced-soulnet-instant-data';
  private static readonly CACHE_DURATION = 3 * 60 * 1000; // 3 minutes for instant access
  private static cache = new Map<string, CachedInstantData>();
  private static worker: Worker | null = null;
  private static preloadingPromises = new Map<string, Promise<InstantSoulNetData | null>>();

  static async initializeWorker(): Promise<void> {
    if (!this.worker && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('../workers/soulNetWorker.ts', import.meta.url), {
          type: 'module'
        });
        console.log('[EnhancedSoulNetPreloadService] Web Worker initialized');
      } catch (error) {
        console.warn('[EnhancedSoulNetPreloadService] Failed to initialize worker:', error);
      }
    }
  }

  static async preloadInstantData(
    userId: string,
    timeRange: string,
    language: string
  ): Promise<InstantSoulNetData | null> {
    const cacheKey = `${userId}-${timeRange}-${language}`;
    
    // Check if we're already preloading this data
    if (this.preloadingPromises.has(cacheKey)) {
      console.log('[EnhancedSoulNetPreloadService] Using existing preload promise for', cacheKey);
      return this.preloadingPromises.get(cacheKey)!;
    }

    // Create preload promise
    const preloadPromise = this.performPreload(userId, timeRange, language);
    this.preloadingPromises.set(cacheKey, preloadPromise);

    try {
      const result = await preloadPromise;
      return result;
    } finally {
      this.preloadingPromises.delete(cacheKey);
    }
  }

  private static async performPreload(
    userId: string,
    timeRange: string,
    language: string
  ): Promise<InstantSoulNetData | null> {
    console.log('[EnhancedSoulNetPreloadService] Starting instant preload for', userId, timeRange, language);
    
    const cacheKey = `${userId}-${timeRange}-${language}`;
    const cached = this.getInstantData(cacheKey);
    
    if (cached) {
      console.log('[EnhancedSoulNetPreloadService] Using cached instant data');
      return cached.data;
    }

    try {
      // Initialize worker if needed
      await this.initializeWorker();

      // Fetch raw data
      const startDate = this.getStartDate(timeRange);
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('id, entityemotion, "refined text", "transcription text"')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[EnhancedSoulNetPreloadService] Database error:', error);
        return null;
      }

      if (!entries || entries.length === 0) {
        const emptyData: InstantSoulNetData = {
          nodes: [],
          links: [],
          translations: new Map(),
          connectionPercentages: new Map(),
          nodeConnectionData: new Map()
        };
        return emptyData;
      }

      // Process entities and generate graph
      const graphData = this.processEntities(entries);
      
      // Pre-calculate all connection percentages using worker if available
      let connectionPercentages = new Map<string, number>();
      if (this.worker) {
        connectionPercentages = await this.calculatePercentagesWithWorker(graphData.nodes, graphData.links);
      } else {
        connectionPercentages = this.calculatePercentagesFallback(graphData.nodes, graphData.links);
      }

      // Pre-translate all node names
      const translations = new Map<string, string>();
      if (language !== 'en') {
        const nodesToTranslate = graphData.nodes.map(node => node.id);
        console.log('[EnhancedSoulNetPreloadService] Pre-translating', nodesToTranslate.length, 'node names');
        
        const batchResults = await translationService.batchTranslate({
          texts: nodesToTranslate,
          targetLanguage: language
        });
        
        batchResults.forEach((translatedText, originalText) => {
          translations.set(originalText, translatedText);
        });
      }

      // Pre-calculate node connection metadata
      const nodeConnectionData = this.calculateNodeConnectionData(graphData.nodes, graphData.links);

      const instantData: InstantSoulNetData = {
        nodes: graphData.nodes,
        links: graphData.links,
        translations,
        connectionPercentages,
        nodeConnectionData
      };

      // Cache the instant data
      this.setInstantData(cacheKey, {
        data: instantData,
        timestamp: Date.now(),
        userId,
        timeRange,
        language
      });

      console.log('[EnhancedSoulNetPreloadService] Successfully preloaded instant data with', 
        graphData.nodes.length, 'nodes,', 
        connectionPercentages.size, 'percentages,',
        translations.size, 'translations');
      
      return instantData;
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] Error in instant preload:', error);
      return null;
    }
  }

  private static async calculatePercentagesWithWorker(
    nodes: NodeData[],
    links: LinkData[]
  ): Promise<Map<string, number>> {
    return new Promise((resolve) => {
      if (!this.worker) {
        resolve(this.calculatePercentagesFallback(nodes, links));
        return;
      }

      const handleMessage = (e: MessageEvent) => {
        if (e.data.type === 'PERCENTAGES_CALCULATED') {
          this.worker!.removeEventListener('message', handleMessage);
          // FIXED: Properly type the percentages object as Record<string, number>
          const percentagesObj = e.data.payload.percentages as Record<string, number>;
          const percentagesMap = new Map(Object.entries(percentagesObj));
          resolve(percentagesMap);
        } else if (e.data.type === 'ERROR') {
          this.worker!.removeEventListener('message', handleMessage);
          console.warn('[EnhancedSoulNetPreloadService] Worker error, using fallback');
          resolve(this.calculatePercentagesFallback(nodes, links));
        }
      };

      this.worker.addEventListener('message', handleMessage);
      this.worker.postMessage({
        type: 'CALCULATE_PERCENTAGES',
        payload: { nodes, links }
      });

      // Timeout fallback
      setTimeout(() => {
        this.worker!.removeEventListener('message', handleMessage);
        console.warn('[EnhancedSoulNetPreloadService] Worker timeout, using fallback');
        resolve(this.calculatePercentagesFallback(nodes, links));
      }, 5000);
    });
  }

  private static calculatePercentagesFallback(
    nodes: NodeData[],
    links: LinkData[]
  ): Map<string, number> {
    console.log('[EnhancedSoulNetPreloadService] Using fallback percentage calculation');
    
    const percentageMap = new Map<string, number>();
    const nodeConnectionTotals = new Map<string, number>();
    
    // Calculate total connection strength for each node
    links.forEach(link => {
      const sourceTotal = nodeConnectionTotals.get(link.source) || 0;
      const targetTotal = nodeConnectionTotals.get(link.target) || 0;
      
      nodeConnectionTotals.set(link.source, sourceTotal + link.value);
      nodeConnectionTotals.set(link.target, targetTotal + link.value);
    });

    // Calculate percentages for each connection
    links.forEach(link => {
      const sourceTotal = nodeConnectionTotals.get(link.source) || 1;
      const targetTotal = nodeConnectionTotals.get(link.target) || 1;
      
      const sourcePercentage = Math.round((link.value / sourceTotal) * 100);
      percentageMap.set(`${link.source}-${link.target}`, sourcePercentage);
      
      const targetPercentage = Math.round((link.value / targetTotal) * 100);
      percentageMap.set(`${link.target}-${link.source}`, targetPercentage);
    });

    return percentageMap;
  }

  private static calculateNodeConnectionData(
    nodes: NodeData[],
    links: LinkData[]
  ): Map<string, NodeConnectionData> {
    const nodeData = new Map<string, NodeConnectionData>();
    
    nodes.forEach(node => {
      const connectedNodes: string[] = [];
      let totalStrength = 0;
      let connectionCount = 0;
      
      links.forEach(link => {
        if (link.source === node.id) {
          connectedNodes.push(link.target);
          totalStrength += link.value;
          connectionCount++;
        } else if (link.target === node.id) {
          connectedNodes.push(link.source);
          totalStrength += link.value;
          connectionCount++;
        }
      });
      
      nodeData.set(node.id, {
        connectedNodes: [...new Set(connectedNodes)], // Remove duplicates
        totalStrength,
        averageStrength: connectionCount > 0 ? totalStrength / connectionCount : 0
      });
    });
    
    return nodeData;
  }

  static getInstantData(cacheKey: string): CachedInstantData | null {
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached;
    }
    
    // Try localStorage
    try {
      const stored = localStorage.getItem(`${this.CACHE_KEY}-${cacheKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if ((Date.now() - parsed.timestamp) < this.CACHE_DURATION) {
          // Convert objects back to Maps
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

  private static setInstantData(cacheKey: string, data: CachedInstantData): void {
    this.cache.set(cacheKey, data);
    
    // Store in localStorage
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
    
    // UPDATED POSITIONING: Emotions now at Y positions +10 and -10 (closer to center)
    const EMOTION_LAYER_RADIUS = 11;
    const ENTITY_LAYER_RADIUS = 9; // INCREASED: from 6 to 9 (1.5x increase)
    const ENTITY_Y_SPAN = 6; // Keep entities in center layer with smaller Y-range

    console.log("[EnhancedSoulNetPreloadService] UPDATED POSITIONING: Generating graph with", entityList.length, "entities with increased radius (9) and emotions at Y positions (+10/-10)");
    
    entityList.forEach((entity, entityIndex) => {
      entityNodes.add(entity);
      const entityAngle = (entityIndex / entityList.length) * Math.PI * 2;
      const entityRadius = ENTITY_LAYER_RADIUS;
      const entityX = Math.cos(entityAngle) * entityRadius;
      // Keep entities in center layer with small Y-range variation
      const entityY = ((entityIndex % 2) === 0 ? -1 : 1) * 0.7 * (Math.random() - 0.5) * ENTITY_Y_SPAN;
      // Z-axis uses circular distribution same as X-axis
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
      
      // UPDATED: Emotions now positioned at Y positions +10 and -10 (closer to center)
      const emotionY = (emotionIndex % 2 === 0) ? 10 : -10;
      
      // Z-axis uses circular distribution (same pattern as X-axis)
      const emotionZ = Math.sin(emotionAngle) * emotionRadius;
      
      nodes.push({
        id: emotion,
        type: 'emotion',
        value: 0.8,
        color: '#fff',
        position: [emotionX, emotionY, emotionZ]
      });
    });

    console.log("[EnhancedSoulNetPreloadService] UPDATED POSITIONING: Generated graph with", nodes.length, "nodes and", links.length, "links");
    console.log("[EnhancedSoulNetPreloadService] UPDATED POSITIONING: Entities form circle with radius 9, emotions at Y positions (+10/-10)");
    return { nodes, links };
  }

  static clearInstantCache(userId?: string): void {
    if (userId) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(userId));
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        localStorage.removeItem(`${this.CACHE_KEY}-${key}`);
      });
      console.log(`[EnhancedSoulNetPreloadService] Cleared instant cache for user ${userId}`);
    } else {
      this.cache.clear();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.CACHE_KEY)) {
          localStorage.removeItem(key);
        }
      });
      console.log('[EnhancedSoulNetPreloadService] Cleared all instant cache');
    }
  }
}
