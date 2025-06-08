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

interface EnhancedSoulNetData {
  nodes: NodeData[];
  links: LinkData[];
  translations: Map<string, string>;
  connectionPercentages: Map<string, number>;
  nodeConnectionData: Map<string, NodeConnectionData>;
  translationComplete: boolean; // NEW: Track if all translations are complete
  translationProgress: number; // NEW: Track translation progress (0-100)
}

interface CachedEnhancedData {
  data: EnhancedSoulNetData;
  timestamp: number;
  userId: string;
  timeRange: string;
  language: string;
  version: number;
}

// APP-LEVEL: Translation service interface for integration
interface AppLevelTranslationService {
  batchTranslate(options: { texts: string[], targetLanguage: string, sourceLanguage?: string }): Promise<Map<string, string>>;
}

export class EnhancedSoulNetPreloadService {
  private static readonly CACHE_KEY = 'enhanced-soulnet-data';
  private static readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  private static readonly CACHE_VERSION = 4; // Increment for translation state tracking
  private static cache = new Map<string, CachedEnhancedData>();
  private static translationCoordinator = new Map<string, Promise<Map<string, string>>>();
  
  // NEW: Translation state tracking
  private static translationStates = new Map<string, {
    isTranslating: boolean;
    progress: number;
    totalNodes: number;
    translatedNodes: number;
  }>();
  
  // APP-LEVEL: Store reference to app-level translation service
  private static appTranslationService: AppLevelTranslationService | null = null;

  // APP-LEVEL: Method to set the app-level translation service
  static setAppLevelTranslationService(service: AppLevelTranslationService) {
    console.log('[EnhancedSoulNetPreloadService] APP-LEVEL: Setting app-level translation service');
    this.appTranslationService = service;
  }

  // NEW: Get translation state for a cache key
  static getTranslationState(cacheKey: string) {
    return this.translationStates.get(cacheKey) || {
      isTranslating: false,
      progress: 100,
      totalNodes: 0,
      translatedNodes: 0
    };
  }

  static async preloadInstantData(
    userId: string, 
    timeRange: string, 
    language: string
  ): Promise<EnhancedSoulNetData | null> {
    console.log(`[EnhancedSoulNetPreloadService] APP-LEVEL: Preloading instant data for ${userId}, ${timeRange}, ${language}`);
    
    const cacheKey = this.generateCacheKey(userId, timeRange, language);
    const cached = this.getInstantData(cacheKey);
    
    // If we have cached data and it's complete, return it
    if (cached && cached.data.translationComplete) {
      console.log(`[EnhancedSoulNetPreloadService] APP-LEVEL: Using cached complete data for ${cacheKey}`);
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
          nodeConnectionData: new Map(),
          translationComplete: true,
          translationProgress: 100
        };
        return emptyData;
      }

      console.log(`[EnhancedSoulNetPreloadService] APP-LEVEL: Found ${entries.length} entries for processing`);

      // Process the raw data
      const graphData = this.processEntities(entries);
      
      // Initialize translation state
      const uniqueNodes = [...new Set(graphData.nodes.map(node => node.id))];
      this.translationStates.set(cacheKey, {
        isTranslating: language !== 'en' && uniqueNodes.length > 0,
        progress: language === 'en' ? 100 : 0,
        totalNodes: uniqueNodes.length,
        translatedNodes: language === 'en' ? uniqueNodes.length : 0
      });

      // APP-LEVEL: Use app-level translation service for coordinated translation
      const translations = await this.getAppLevelCoordinatedTranslations(graphData.nodes, language, cacheKey);
      const connectionPercentages = new Map<string, number>();
      const nodeConnectionData = new Map<string, NodeConnectionData>();
      
      // Pre-calculate connection percentages and node connection data
      this.calculateConnectionPercentages(graphData, connectionPercentages);
      this.calculateNodeConnections(graphData, nodeConnectionData);

      // Check if translation is complete
      const isTranslationComplete = language === 'en' || translations.size === uniqueNodes.length;
      const translationProgress = language === 'en' ? 100 : Math.round((translations.size / uniqueNodes.length) * 100);

      // Update translation state
      this.translationStates.set(cacheKey, {
        isTranslating: false,
        progress: translationProgress,
        totalNodes: uniqueNodes.length,
        translatedNodes: translations.size
      });

      const enhancedData: EnhancedSoulNetData = {
        nodes: graphData.nodes,
        links: graphData.links,
        translations,
        connectionPercentages,
        nodeConnectionData,
        translationComplete: isTranslationComplete,
        translationProgress
      };

      // Only cache if translation is complete to avoid partial states
      if (isTranslationComplete) {
        this.setCachedData(cacheKey, {
          data: enhancedData,
          timestamp: Date.now(),
          userId,
          timeRange,
          language,
          version: this.CACHE_VERSION
        });
        console.log(`[EnhancedSoulNetPreloadService] APP-LEVEL: Successfully cached complete data for ${cacheKey}`);
      } else {
        console.log(`[EnhancedSoulNetPreloadService] APP-LEVEL: Translation incomplete, not caching for ${cacheKey}`);
      }

      return enhancedData;
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] Error preloading instant data:', error);
      // Clear translation state on error
      this.translationStates.delete(cacheKey);
      return null;
    }
  }

  // INSTANT ACCESS: Synchronous cache check
  static getInstantData(cacheKey: string): CachedEnhancedData | null {
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      console.log(`[EnhancedSoulNetPreloadService] APP-LEVEL: Found valid cache for ${cacheKey}`);
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
          // Ensure new fields have defaults
          parsed.data.translationComplete = parsed.data.translationComplete ?? true;
          parsed.data.translationProgress = parsed.data.translationProgress ?? 100;
          
          this.cache.set(cacheKey, parsed);
          console.log(`[EnhancedSoulNetPreloadService] APP-LEVEL: Found valid localStorage cache for ${cacheKey}`);
          return parsed;
        }
      }
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] Error loading from localStorage:', error);
    }
    
    console.log(`[EnhancedSoulNetPreloadService] APP-LEVEL: No valid cache found for ${cacheKey}`);
    return null;
  }

  // APP-LEVEL: New coordinated translation using app-level service
  private static async getAppLevelCoordinatedTranslations(
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
      console.log(`[EnhancedSoulNetPreloadService] APP-LEVEL: Waiting for existing translation for ${cacheKey}`);
      return existingTranslation;
    }

    // Start new coordinated translation using app-level service
    const translationPromise = this.performAppLevelBatchTranslation(nodes, language, cacheKey);
    this.translationCoordinator.set(cacheKey, translationPromise);

    try {
      const result = await translationPromise;
      return result;
    } finally {
      // Clean up coordinator
      this.translationCoordinator.delete(cacheKey);
    }
  }

  // APP-LEVEL: Enhanced batch translation with proper source language
  private static async performAppLevelBatchTranslation(nodes: NodeData[], language: string, cacheKey: string): Promise<Map<string, string>> {
    const translations = new Map<string, string>();
    const nodesToTranslate = [...new Set(nodes.map(node => node.id))]; // Remove duplicates
    
    console.log(`[EnhancedSoulNetPreloadService] APP-LEVEL: Batch translating ${nodesToTranslate.length} unique nodes using app-level service`);
    
    // Update translation state
    this.translationStates.set(cacheKey, {
      isTranslating: true,
      progress: 0,
      totalNodes: nodesToTranslate.length,
      translatedNodes: 0
    });
    
    try {
      if (!this.appTranslationService) {
        console.warn('[EnhancedSoulNetPreloadService] APP-LEVEL: No app-level translation service available, using fallback');
        // Fallback: set original text for all nodes
        nodesToTranslate.forEach(nodeId => {
          translations.set(nodeId, nodeId);
        });
        
        // Update completion state
        this.translationStates.set(cacheKey, {
          isTranslating: false,
          progress: 100,
          totalNodes: nodesToTranslate.length,
          translatedNodes: nodesToTranslate.length
        });
        
        return translations;
      }

      // FIXED: Perform atomic batch translation with proper source language
      const batchResults = await this.appTranslationService.batchTranslate({
        texts: nodesToTranslate,
        targetLanguage: language,
        sourceLanguage: 'en' // Fix: Use 'en' instead of 'auto'
      });
      
      console.log(`[EnhancedSoulNetPreloadService] APP-LEVEL: Successfully translated ${batchResults.size}/${nodesToTranslate.length} nodes`);
      
      batchResults.forEach((translatedText, originalText) => {
        translations.set(originalText, translatedText);
      });

      // Handle any missing translations
      nodesToTranslate.forEach(nodeId => {
        if (!translations.has(nodeId)) {
          console.warn(`[EnhancedSoulNetPreloadService] APP-LEVEL: No translation found for node: ${nodeId}, using original`);
          translations.set(nodeId, nodeId);
        }
      });

      // Update completion state
      this.translationStates.set(cacheKey, {
        isTranslating: false,
        progress: 100,
        totalNodes: nodesToTranslate.length,
        translatedNodes: translations.size
      });

    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] APP-LEVEL: Error during batch translation:', error);
      // Fallback: set original text for all nodes
      nodesToTranslate.forEach(nodeId => {
        translations.set(nodeId, nodeId);
      });
      
      // Update error state
      this.translationStates.set(cacheKey, {
        isTranslating: false,
        progress: 100,
        totalNodes: nodesToTranslate.length,
        translatedNodes: nodesToTranslate.length
      });
    }

    return translations;
  }

  private static calculateNodeConnections(
    graphData: { nodes: NodeData[], links: LinkData[] },
    nodeConnectionMap: Map<string, NodeConnectionData>
  ): void {
    console.log('[EnhancedSoulNetPreloadService] APP-LEVEL: Pre-calculating node connections');
    
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

    console.log(`[EnhancedSoulNetPreloadService] APP-LEVEL: Pre-calculated connections for ${nodeConnectionMap.size} nodes`);
  }

  private static calculateConnectionPercentages(
    graphData: { nodes: NodeData[], links: LinkData[] },
    percentageMap: Map<string, number>
  ): void {
    console.log('[EnhancedSoulNetPreloadService] APP-LEVEL: Pre-calculating connection percentages');
    
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

    console.log(`[EnhancedSoulNetPreloadService] APP-LEVEL: Pre-calculated ${percentageMap.size} connection percentages`);
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
    console.log(`[EnhancedSoulNetPreloadService] APP-LEVEL: Clearing instant cache for user ${userId || 'all users'}`);
    
    if (userId) {
      // Clear specific user's cache including all versions
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(userId));
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        localStorage.removeItem(`${this.CACHE_KEY}-${key}`);
        this.translationStates.delete(key);
      });
      
      // Clear translation coordinator for this user
      const coordinatorKeysToDelete = Array.from(this.translationCoordinator.keys()).filter(key => key.startsWith(userId));
      coordinatorKeysToDelete.forEach(key => {
        this.translationCoordinator.delete(key);
      });
      
      console.log(`[EnhancedSoulNetPreloadService] APP-LEVEL: Cleared instant cache for user ${userId}`);
    } else {
      // Clear all cache
      this.cache.clear();
      this.translationCoordinator.clear();
      this.translationStates.clear();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.CACHE_KEY)) {
          localStorage.removeItem(key);
        }
      });
      console.log('[EnhancedSoulNetPreloadService] APP-LEVEL: Cleared all instant cache');
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
    console.log("[EnhancedSoulNetPreloadService] APP-LEVEL: Processing entities for", entries.length, "entries");
    
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

    console.log("[EnhancedSoulNetPreloadService] APP-LEVEL: Generating graph with", entityList.length, "entities");
    
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
        color: '#22c55e', // Green for entity nodes (spheres)
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

    // CUSTOM Y-AXIS POSITIONING: Apply specific pattern to emotion nodes (squares)
    Array.from(emotionNodes).forEach((emotion, emotionIndex) => {
      const emotionAngle = (emotionIndex / emotionNodes.size) * Math.PI * 2;
      const emotionRadius = EMOTION_LAYER_RADIUS;
      const emotionX = Math.cos(emotionAngle) * emotionRadius;
      
      // CUSTOM PATTERN: Node 1: +7, Node 2: -7, Node 3: +9, Node 4: -9, Node 5: +11, Node 6: -11, Node 7: +13, Node 8: -13, then cycle
      const getCustomYPosition = (index: number): number => {
        const cyclePosition = index % 8; // 8-node cycle
        const basePairs = [
          [7, -7],   // Nodes 1-2
          [9, -9],   // Nodes 3-4
          [11, -11], // Nodes 5-6
          [13, -13]  // Nodes 7-8
        ];
        
        const pairIndex = Math.floor(cyclePosition / 2);
        const isEven = cyclePosition % 2 === 1; // 0-indexed, so index 1 is the second in pair
        
        return basePairs[pairIndex][isEven ? 1 : 0]; // Return negative for second in pair, positive for first
      };
      
      const emotionY = getCustomYPosition(emotionIndex);
      const emotionZ = Math.sin(emotionAngle) * emotionRadius;
      
      console.log(`[EnhancedSoulNetPreloadService] CUSTOM Y-POSITIONING: Emotion node ${emotionIndex + 1} "${emotion}" positioned at Y=${emotionY}`);
      
      nodes.push({
        id: emotion,
        type: 'emotion',
        value: 0.8,
        color: '#f59e0b', // Golden for emotion nodes (cubes)
        position: [emotionX, emotionY, emotionZ]
      });
    });

    console.log("[EnhancedSoulNetPreloadService] APP-LEVEL: Generated graph with", nodes.length, "nodes and", links.length, "links");
    console.log("[EnhancedSoulNetPreloadService] CUSTOM COLORS: Applied GREEN to entity nodes (spheres) and GOLDEN to emotion nodes (squares)");
    return { nodes, links };
  }
}
