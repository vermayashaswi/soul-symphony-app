import { nodeTranslationCache } from './nodeTranslationCache';
import { supabase } from '@/integrations/supabase/client';
import { SoulNetDataProcessor } from './soulNetDataProcessor';

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
  private static readonly CACHE_VERSION = 3; // Incremented for new logic
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
      
      // FIXED: Use .or() filter to include entries with EITHER entities OR emotions (not both required)
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('id, entities, emotions, master_themes, created_at')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .or('entities.not.is.null,emotions.not.is.null,master_themes.not.is.null');

      if (error) {
        console.error('[EnhancedSoulNetPreloadService] Error fetching journal entries:', error);
        return null;
      }

      if (!entries || entries.length === 0) {
        console.log(`[EnhancedSoulNetPreloadService] No journal entries found for user ${userId}, timeRange ${timeRange}`);
        return { nodes: [], links: [] };
      }

      console.log(`[EnhancedSoulNetPreloadService] Processing ${entries.length} journal entries`);
      console.log(`[EnhancedSoulNetPreloadService] Sample entry:`, entries[0]);

      // ENHANCED: Use the separated data processor for better handling
      const { entityCounts, emotionCounts, coOccurrences } = SoulNetDataProcessor.processJournalEntries(entries);

      console.log(`[EnhancedSoulNetPreloadService] Processed counts:`, {
        entities: entityCounts.size,
        emotions: emotionCounts.size,
        coOccurrences: coOccurrences.size
      });

      // ENHANCED: Use the separated processor for filtering
      const { entities: filteredEntities, emotions: filteredEmotions } = SoulNetDataProcessor.filterSignificantNodes(
        entityCounts,
        emotionCounts,
        1, // Lower threshold for entities (was 2)
        0.8 // Lower threshold for emotions (was 1.0)
      );

      console.log(`[EnhancedSoulNetPreloadService] After filtering:`, {
        entities: filteredEntities.size,
        emotions: filteredEmotions.size
      });

      // Create nodes
      const nodes: NodeData[] = [];
      let nodeIndex = 0;

      // Add entity nodes
      filteredEntities.forEach((count, entity) => {
        const position = SoulNetDataProcessor.generateNodePositions(
          filteredEntities.size + filteredEmotions.size,
          nodeIndex++
        );
        
        nodes.push({
          id: entity,
          type: 'entity',
          value: count,
          color: '#22c55e', // Green for entities
          position
        });
      });

      // Add emotion nodes
      filteredEmotions.forEach((totalIntensity, emotion) => {
        const position = SoulNetDataProcessor.generateNodePositions(
          filteredEntities.size + filteredEmotions.size,
          nodeIndex++
        );
        
        nodes.push({
          id: emotion,
          type: 'emotion',
          value: totalIntensity,
          color: '#f59e0b', // Golden for emotions
          position
        });
      });

      // Create links from co-occurrences
      const links: LinkData[] = [];
      const nodeIds = new Set(nodes.map(n => n.id));

      coOccurrences.forEach((count, key) => {
        if (count >= 1) { // Lower threshold for links
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
      
      // DEBUGGING: Log some sample nodes and links
      if (nodes.length > 0) {
        console.log(`[EnhancedSoulNetPreloadService] Sample nodes:`, nodes.slice(0, 3));
      }
      if (links.length > 0) {
        console.log(`[EnhancedSoulNetPreloadService] Sample links:`, links.slice(0, 3));
      }
      
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
