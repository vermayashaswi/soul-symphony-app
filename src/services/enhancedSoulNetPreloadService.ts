import { nodeTranslationCache } from './nodeTranslationCache';
import { supabase } from '@/integrations/supabase/client';

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
  translationProgress: number;
  translationComplete: boolean;
}

interface CachedInstantData {
  data: InstantSoulNetData;
  timestamp: number;
  version: number;
}

class EnhancedSoulNetPreloadService {
  private static instantCache = new Map<string, CachedInstantData>();
  private static readonly CACHE_VERSION = 2;
  private static readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  private static translationService: any = null;

  static setAppLevelTranslationService(service: any) {
    this.translationService = service;
  }

  private static calculateAllConnectionPercentages(links: LinkData[]): Map<string, number> {
    const connectionPercentages = new Map<string, number>();

    const calculateConnectionPercentage = (nodeId: string, targetNode: string, allLinks: LinkData[]): number => {
      const nodeLinks = allLinks.filter(link =>
        (link.source === nodeId && link.target === targetNode) ||
        (link.target === nodeId && link.source === targetNode)
      );

      const totalValue = nodeLinks.reduce((sum, link) => sum + link.value, 0);
      if (totalValue === 0) return 0;

      const link = nodeLinks[0];
      if (!link) return 0;

      return (link.value / totalValue) * 100;
    };

    const uniqueNodes = new Set<string>();
    links.forEach(link => {
      uniqueNodes.add(link.source);
      uniqueNodes.add(link.target);
    });

    uniqueNodes.forEach(nodeId => {
      uniqueNodes.forEach(targetNode => {
        if (nodeId !== targetNode) {
          const percentage = calculateConnectionPercentage(nodeId, targetNode, links);
          const key = `${nodeId}-${targetNode}`;
          connectionPercentages.set(key, percentage);
        }
      });
    });

    return connectionPercentages;
  }

  private static calculateAllNodeConnections(links: LinkData[]): Map<string, NodeConnectionData> {
    const nodeConnections = new Map<string, NodeConnectionData>();

    const getNodeConnections = (nodeId: string, allLinks: LinkData[]): NodeConnectionData => {
      const connectedNodes: string[] = [];
      let totalStrength = 0;

      allLinks.forEach(link => {
        if (link.source === nodeId) {
          connectedNodes.push(link.target);
          totalStrength += link.value;
        } else if (link.target === nodeId) {
          connectedNodes.push(link.source);
          totalStrength += link.value;
        }
      });

      const averageStrength = connectedNodes.length > 0 ? totalStrength / connectedNodes.length : 0;

      return {
        connectedNodes,
        totalStrength,
        averageStrength
      };
    };

    const uniqueNodes = new Set<string>();
    links.forEach(link => {
      uniqueNodes.add(link.source);
      uniqueNodes.add(link.target);
    });

    uniqueNodes.forEach(nodeId => {
      nodeConnections.set(nodeId, getNodeConnections(nodeId, links));
    });

    return nodeConnections;
  }

  private static getTimeRangeFilter(timeRange: string): string {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = new Date(0); // Very old date
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default to week
        break;
    }

    return startDate.toISOString();
  }

  private static async fetchSoulNetData(userId: string, timeRange: string): Promise<{ nodes: NodeData[]; links: LinkData[] } | null> {
    try {
      console.log(`[EnhancedSoulNetPreloadService] Processing SoulNet data for user ${userId}, timeRange ${timeRange}`);
      
      // Get time range filter
      const startDate = this.getTimeRangeFilter(timeRange);
      
      // Fetch journal entries with entities and emotions
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('id, entities, emotions, created_at')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .not('entities', 'is', null)
        .not('emotions', 'is', null);

      if (error) {
        console.error('[EnhancedSoulNetPreloadService] Error fetching journal entries:', error);
        return null;
      }

      if (!entries || entries.length === 0) {
        console.log(`[EnhancedSoulNetPreloadService] No journal entries found for user ${userId}, timeRange ${timeRange}`);
        return { nodes: [], links: [] };
      }

      console.log(`[EnhancedSoulNetPreloadService] Processing ${entries.length} journal entries`);

      // Process entities and emotions to create nodes and links
      const entityCounts = new Map<string, number>();
      const emotionCounts = new Map<string, number>();
      const coOccurrences = new Map<string, number>();

      entries.forEach(entry => {
        const entryEntities: string[] = [];
        const entryEmotions: string[] = [];

        // Process entities
        if (entry.entities && Array.isArray(entry.entities)) {
          entry.entities.forEach((entity: any) => {
            if (entity && typeof entity === 'object' && entity.name) {
              const entityName = entity.name.toLowerCase().trim();
              if (entityName) {
                entryEntities.push(entityName);
                entityCounts.set(entityName, (entityCounts.get(entityName) || 0) + 1);
              }
            }
          });
        }

        // Process emotions
        if (entry.emotions) {
          if (typeof entry.emotions === 'object' && !Array.isArray(entry.emotions)) {
            // Handle object format {joy: 0.7, sadness: 0.5}
            Object.entries(entry.emotions).forEach(([emotion, intensity]) => {
              if (typeof intensity === 'number' && intensity > 0.3) { // Only include significant emotions
                const emotionName = emotion.toLowerCase().trim();
                if (emotionName) {
                  entryEmotions.push(emotionName);
                  emotionCounts.set(emotionName, (emotionCounts.get(emotionName) || 0) + intensity);
                }
              }
            });
          } else if (Array.isArray(entry.emotions)) {
            // Handle array format
            entry.emotions.forEach((emotion: any) => {
              if (emotion && typeof emotion === 'object' && emotion.name && emotion.intensity) {
                const emotionName = emotion.name.toLowerCase().trim();
                const intensity = parseFloat(emotion.intensity);
                if (emotionName && intensity > 0.3) {
                  entryEmotions.push(emotionName);
                  emotionCounts.set(emotionName, (emotionCounts.get(emotionName) || 0) + intensity);
                }
              }
            });
          }
        }

        // Calculate co-occurrences within this entry
        const allNodes = [...entryEntities, ...entryEmotions];
        for (let i = 0; i < allNodes.length; i++) {
          for (let j = i + 1; j < allNodes.length; j++) {
            const node1 = allNodes[i];
            const node2 = allNodes[j];
            if (node1 !== node2) {
              const key = [node1, node2].sort().join('|');
              coOccurrences.set(key, (coOccurrences.get(key) || 0) + 1);
            }
          }
        }
      });

      // Filter and create nodes (only include items that appear more than once or have strong emotions)
      const nodes: NodeData[] = [];
      const nodePositions = new Map<string, [number, number, number]>();

      // Add entity nodes
      entityCounts.forEach((count, entity) => {
        if (count >= 2) { // Only include entities that appear at least twice
          const angle = (nodes.length * 2 * Math.PI) / Math.max(entityCounts.size + emotionCounts.size, 8);
          const radius = 15;
          const position: [number, number, number] = [
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            (Math.random() - 0.5) * 10
          ];
          
          nodePositions.set(entity, position);
          nodes.push({
            id: entity,
            type: 'entity',
            value: count,
            color: '#22c55e', // Green for entities
            position
          });
        }
      });

      // Add emotion nodes
      emotionCounts.forEach((totalIntensity, emotion) => {
        if (totalIntensity >= 1.0) { // Only include emotions with significant total intensity
          const angle = (nodes.length * 2 * Math.PI) / Math.max(entityCounts.size + emotionCounts.size, 8);
          const radius = 15;
          const position: [number, number, number] = [
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            (Math.random() - 0.5) * 10
          ];
          
          nodePositions.set(emotion, position);
          nodes.push({
            id: emotion,
            type: 'emotion',
            value: totalIntensity,
            color: '#f59e0b', // Golden for emotions
            position
          });
        }
      });

      // Create links from co-occurrences
      const links: LinkData[] = [];
      const nodeIds = new Set(nodes.map(n => n.id));

      coOccurrences.forEach((count, key) => {
        if (count >= 2) { // Only include relationships that occur at least twice
          const [node1, node2] = key.split('|');
          if (nodeIds.has(node1) && nodeIds.has(node2)) {
            links.push({
              source: node1,
              target: node2,
              value: count
            });
          }
        }
      });

      console.log(`[EnhancedSoulNetPreloadService] Generated ${nodes.length} nodes and ${links.length} links`);
      
      return { nodes, links };
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] Error processing SoulNet data:', error);
      return null;
    }
  }

  static async preloadInstantData(
    userId: string,
    timeRange: string,
    targetLanguage: string
  ): Promise<InstantSoulNetData | null> {
    const cacheKey = `${userId}-${timeRange}-${targetLanguage}`;
    console.log(`[EnhancedSoulNetPreloadService] PRELOAD START: ${cacheKey}`);

    // Check centralized node translation cache first
    const isCacheComplete = nodeTranslationCache.isCacheComplete(userId, timeRange, targetLanguage);
    if (isCacheComplete) {
      console.log(`[EnhancedSoulNetPreloadService] CENTRALIZED CACHE COMPLETE: ${cacheKey}`);
      
      // Try to get data from instant cache
      const cached = this.getInstantData(cacheKey);
      if (cached && cached.data.translationComplete) {
        return cached.data;
      }
    }

    try {
      // Fetch raw data
      const rawData = await this.fetchSoulNetData(userId, timeRange);
      if (!rawData || rawData.nodes.length === 0) {
        console.log(`[EnhancedSoulNetPreloadService] NO DATA: ${cacheKey}`);
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

      console.log(`[EnhancedSoulNetPreloadService] RAW DATA: ${rawData.nodes.length} nodes, ${rawData.links.length} links`);

      // Extract unique node IDs for translation
      const nodeIds = rawData.nodes.map(node => node.id);
      
      // Use centralized cache for batch translation
      const translations = await nodeTranslationCache.prePopulateCache(
        userId,
        timeRange,
        targetLanguage,
        nodeIds
      );

      console.log(`[EnhancedSoulNetPreloadService] TRANSLATIONS: ${translations.size} for ${nodeIds.length} nodes`);

      // Calculate connection data
      const connectionPercentages = this.calculateAllConnectionPercentages(rawData.links);
      const nodeConnectionData = this.calculateAllNodeConnections(rawData.links);

      const result: InstantSoulNetData = {
        nodes: rawData.nodes,
        links: rawData.links,
        translations,
        connectionPercentages,
        nodeConnectionData,
        translationProgress: 100,
        translationComplete: true
      };

      // Cache the complete result
      this.setInstantData(cacheKey, result);
      
      console.log(`[EnhancedSoulNetPreloadService] PRELOAD COMPLETE: ${cacheKey}`);
      return result;

    } catch (error) {
      console.error(`[EnhancedSoulNetPreloadService] PRELOAD ERROR: ${cacheKey}`, error);
      return null;
    }
  }

  static clearTimeRangeCache(userId: string, keepTimeRange: string, keepLanguage: string): void {
    console.log(`[EnhancedSoulNetPreloadService] CLEARING OTHER CACHES: keeping ${keepTimeRange}-${keepLanguage}`);
    
    const keysToDelete: string[] = [];
    this.instantCache.forEach((_, key) => {
      if (key.startsWith(`${userId}-`) && !key.endsWith(`${keepTimeRange}-${keepLanguage}`)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.instantCache.delete(key);
      console.log(`[EnhancedSoulNetPreloadService] Deleted cache: ${key}`);
    });

    // Also clear from centralized node cache
    nodeTranslationCache.clearCache(userId);
  }

  static clearInstantCache(): void {
    console.log('[EnhancedSoulNetPreloadService] CLEARING ALL INSTANT CACHE');
    this.instantCache.clear();
  }

  static forceInvalidateCache(userId: string, timeRange: string, language: string): void {
    const cacheKey = `${userId}-${timeRange}-${language}`;
    console.log(`[EnhancedSoulNetPreloadService] FORCE INVALIDATE: ${cacheKey}`);
    
    this.instantCache.delete(cacheKey);
    nodeTranslationCache.clearCache(userId, timeRange, language);
  }

  static getInstantData(cacheKey: string): CachedInstantData | null {
    const cached = this.instantCache.get(cacheKey);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.CACHE_DURATION) {
      console.log(`[EnhancedSoulNetPreloadService] CACHE EXPIRED: ${cacheKey} (${age}ms old)`);
      this.instantCache.delete(cacheKey);
      return null;
    }

    console.log(`[EnhancedSoulNetPreloadService] CACHE HIT: ${cacheKey}`);
    return cached;
  }

  static setInstantData(cacheKey: string, data: InstantSoulNetData): void {
    this.instantCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      version: this.CACHE_VERSION
    });
    console.log(`[EnhancedSoulNetPreloadService] CACHE SET: ${cacheKey}`);
  }
}

export { EnhancedSoulNetPreloadService };
