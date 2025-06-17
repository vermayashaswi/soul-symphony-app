
import { nodeTranslationCache } from './nodeTranslationCache';

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

  private static async fetchSoulNetData(userId: string, timeRange: string): Promise<{ nodes: NodeData[]; links: LinkData[] } | null> {
    try {
      // Since the database table doesn't exist, we'll return mock data for now
      // In a real implementation, this would fetch from the actual database table
      console.log(`[EnhancedSoulNetPreloadService] Mock data for user ${userId}, timeRange ${timeRange}`);
      
      // Return empty data for now - this should be replaced with actual database queries
      // when the journal_insights_soulnet table is created
      const mockData = {
        nodes: [] as NodeData[],
        links: [] as LinkData[]
      };

      return mockData;
    } catch (error) {
      console.error('Error processing SoulNet data:', error);
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
