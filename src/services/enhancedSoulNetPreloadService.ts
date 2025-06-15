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
  translationComplete: boolean;
  translationProgress: number;
}

interface CachedEnhancedData {
  data: EnhancedSoulNetData;
  timestamp: number;
  userId: string;
  timeRange: string;
  language: string;
  version: number;
}

interface AppLevelTranslationService {
  batchTranslate(options: { texts: string[], targetLanguage: string, sourceLanguage?: string }): Promise<Map<string, string>>;
}

export class EnhancedSoulNetPreloadService {
  private static readonly CACHE_KEY = 'enhanced-soulnet-data';
  private static readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  private static readonly CACHE_VERSION = 9; // INCREMENTED: For correct week calculation fix
  private static cache = new Map<string, CachedEnhancedData>();
  private static translationCoordinator = new Map<string, Promise<Map<string, string>>>();
  
  private static translationStates = new Map<string, {
    isTranslating: boolean;
    progress: number;
    totalNodes: number;
    translatedNodes: number;
  }>();
  
  private static appTranslationService: AppLevelTranslationService | null = null;

  static setAppLevelTranslationService(service: AppLevelTranslationService) {
    console.log('[EnhancedSoulNetPreloadService] Setting app-level translation service');
    this.appTranslationService = service;
  }

  // FIXED: Enhanced cache clearing with comprehensive logging
  static clearTimeRangeCache(userId: string, currentTimeRange: string, currentLanguage: string): void {
    const currentCacheKey = this.generateCacheKey(userId, currentTimeRange, currentLanguage);
    console.log(`[EnhancedSoulNetPreloadService] CACHE CLEAR START: Current key: ${currentCacheKey}`);
    
    let clearedCount = 0;
    let storageKeysCleared = 0;
    
    // Clear in-memory cache
    const userPrefix = `${userId}-`;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(userPrefix) && key !== currentCacheKey) {
        console.log(`[EnhancedSoulNetPreloadService] CLEARING IN-MEMORY: ${key}`);
        this.cache.delete(key);
        this.translationStates.delete(key);
        this.translationCoordinator.delete(key);
        clearedCount++;
      }
    }

    // Clear localStorage with enhanced logging
    try {
      const storagePrefix = `${this.CACHE_KEY}-${userId}-`;
      const allStorageKeys = Object.keys(localStorage);
      
      for (const storageKey of allStorageKeys) {
        if (storageKey.startsWith(storagePrefix)) {
          const extractedCacheKey = storageKey.replace(`${this.CACHE_KEY}-`, '');
          if (extractedCacheKey !== currentCacheKey) {
            console.log(`[EnhancedSoulNetPreloadService] CLEARING STORAGE: ${storageKey} (extracted: ${extractedCacheKey})`);
            localStorage.removeItem(storageKey);
            storageKeysCleared++;
          }
        }
      }
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] STORAGE CLEAR ERROR:', error);
    }
    
    console.log(`[EnhancedSoulNetPreloadService] CACHE CLEAR COMPLETE: In-memory: ${clearedCount}, Storage: ${storageKeysCleared}`);
  }

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
    console.log(`[EnhancedSoulNetPreloadService] PRELOAD START: userId=${userId}, timeRange=${timeRange}, language=${language}`);
    
    const cacheKey = this.generateCacheKey(userId, timeRange, language);
    
    // DEFENSIVE: Check cache one more time
    const cached = this.getInstantData(cacheKey);
    if (cached && cached.data.translationComplete) {
      console.log(`[EnhancedSoulNetPreloadService] PRELOAD USING CACHE: ${cacheKey}`);
      return cached.data;
    }

    try {
      // FIXED: Enhanced date range fetching with corrected week calculation
      const startDate = this.getStartDate(timeRange);
      console.log(`[EnhancedSoulNetPreloadService] FETCHING DATA: startDate=${startDate.toISOString()}, timeRange=${timeRange}`);
      console.log(`[EnhancedSoulNetPreloadService] DATE CALCULATION DEBUG: Current time=${new Date().toISOString()}, Calculated start=${startDate.toISOString()}, Range=${timeRange}`);
      
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('id, themeemotion, "refined text", "transcription text"')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[EnhancedSoulNetPreloadService] DATABASE ERROR:', error);
        return null;
      }

      console.log(`[EnhancedSoulNetPreloadService] DATABASE RESULT: ${entries?.length || 0} entries found for timeRange=${timeRange}`);

      if (!entries || entries.length === 0) {
        console.log(`[EnhancedSoulNetPreloadService] NO ENTRIES FOUND for timeRange=${timeRange} - returning empty data`);
        const emptyData: EnhancedSoulNetData = {
          nodes: [], 
          links: [], 
          translations: new Map(), 
          connectionPercentages: new Map(),
          nodeConnectionData: new Map(),
          translationComplete: true,
          translationProgress: 100
        };
        
        // FIXED: Cache empty data to prevent repeated fetching
        this.setCachedData(cacheKey, {
          data: emptyData,
          timestamp: Date.now(),
          userId,
          timeRange,
          language,
          version: this.CACHE_VERSION
        });
        
        return emptyData;
      }

      // Process the data
      const graphData = this.processEntities(entries);
      console.log(`[EnhancedSoulNetPreloadService] PROCESSED DATA: ${graphData.nodes.length} nodes, ${graphData.links.length} links`);
      
      // Handle translations
      const uniqueNodes = [...new Set(graphData.nodes.map(node => node.id))];
      this.translationStates.set(cacheKey, {
        isTranslating: language !== 'en' && uniqueNodes.length > 0,
        progress: language === 'en' ? 100 : 0,
        totalNodes: uniqueNodes.length,
        translatedNodes: language === 'en' ? uniqueNodes.length : 0
      });

      const translations = await this.getAppLevelCoordinatedTranslations(graphData.nodes, language, cacheKey);
      const connectionPercentages = new Map<string, number>();
      const nodeConnectionData = new Map<string, NodeConnectionData>();
      
      this.calculateConnectionPercentages(graphData, connectionPercentages);
      this.calculateNodeConnections(graphData, nodeConnectionData);

      const isTranslationComplete = language === 'en' || translations.size === uniqueNodes.length;
      const translationProgress = language === 'en' ? 100 : Math.round((translations.size / uniqueNodes.length) * 100);

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

      // Cache the result
      if (isTranslationComplete) {
        this.setCachedData(cacheKey, {
          data: enhancedData,
          timestamp: Date.now(),
          userId,
          timeRange,
          language,
          version: this.CACHE_VERSION
        });
        console.log(`[EnhancedSoulNetPreloadService] CACHED COMPLETE DATA: ${cacheKey}`);
      }

      return enhancedData;
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] PRELOAD ERROR:', error);
      this.translationStates.delete(cacheKey);
      return null;
    }
  }

  // ENHANCED: Cache retrieval with version checking
  static getInstantData(cacheKey: string): CachedEnhancedData | null {
    if (!cacheKey) {
      console.log('[EnhancedSoulNetPreloadService] GET CACHE: Empty cache key');
      return null;
    }
    
    // Check in-memory cache first
    const memoryCache = this.cache.get(cacheKey);
    if (memoryCache && this.isCacheValid(memoryCache)) {
      console.log(`[EnhancedSoulNetPreloadService] GET CACHE HIT (MEMORY): ${cacheKey}`);
      return memoryCache;
    } else if (memoryCache) {
      console.log(`[EnhancedSoulNetPreloadService] GET CACHE INVALID (MEMORY): ${cacheKey}, removing`);
      this.cache.delete(cacheKey);
    }
    
    // Check localStorage
    try {
      const storageKey = `${this.CACHE_KEY}-${cacheKey}`;
      const storedData = localStorage.getItem(storageKey);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if (this.isCacheValid(parsed)) {
          // Restore Maps
          parsed.data.translations = new Map(Object.entries(parsed.data.translations || {}));
          parsed.data.connectionPercentages = new Map(Object.entries(parsed.data.connectionPercentages || {}));
          parsed.data.nodeConnectionData = new Map(
            Object.entries(parsed.data.nodeConnectionData || {}).map(([key, value]) => [key, value as NodeConnectionData])
          );
          parsed.data.translationComplete = parsed.data.translationComplete ?? true;
          parsed.data.translationProgress = parsed.data.translationProgress ?? 100;
          
          this.cache.set(cacheKey, parsed);
          console.log(`[EnhancedSoulNetPreloadService] GET CACHE HIT (STORAGE): ${cacheKey}`);
          return parsed;
        } else {
          console.log(`[EnhancedSoulNetPreloadService] GET CACHE INVALID (STORAGE): ${cacheKey}, removing`);
          localStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] GET CACHE ERROR:', error);
    }
    
    console.log(`[EnhancedSoulNetPreloadService] GET CACHE MISS: ${cacheKey}`);
    return null;
  }

  // APP-LEVEL: Enhanced coordinated translation using app-level service
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

    const existingTranslation = this.translationCoordinator.get(cacheKey);
    if (existingTranslation) {
      return existingTranslation;
    }

    const translationPromise = this.performAppLevelBatchTranslation(nodes, language, cacheKey);
    this.translationCoordinator.set(cacheKey, translationPromise);

    try {
      const result = await translationPromise;
      return result;
    } finally {
      this.translationCoordinator.delete(cacheKey);
    }
  }

  // APP-LEVEL: Enhanced batch translation with proper error handling
  private static async performAppLevelBatchTranslation(nodes: NodeData[], language: string, cacheKey: string): Promise<Map<string, string>> {
    const translations = new Map<string, string>();
    const nodesToTranslate = [...new Set(nodes.map(node => node.id))];
    
    this.translationStates.set(cacheKey, {
      isTranslating: true,
      progress: 0,
      totalNodes: nodesToTranslate.length,
      translatedNodes: 0
    });
    
    try {
      if (!this.appTranslationService) {
        nodesToTranslate.forEach(nodeId => {
          translations.set(nodeId, nodeId);
        });
        
        this.translationStates.set(cacheKey, {
          isTranslating: false,
          progress: 100,
          totalNodes: nodesToTranslate.length,
          translatedNodes: nodesToTranslate.length
        });
        
        return translations;
      }

      const batchResults = await this.appTranslationService.batchTranslate({
        texts: nodesToTranslate,
        targetLanguage: language,
        sourceLanguage: 'en'
      });
      
      batchResults.forEach((translatedText, originalText) => {
        if (translatedText && translatedText.trim() !== '') {
          translations.set(originalText, translatedText);
        } else {
          translations.set(originalText, originalText);
        }
      });

      nodesToTranslate.forEach(nodeId => {
        if (!translations.has(nodeId)) {
          translations.set(nodeId, nodeId);
        }
      });

      this.translationStates.set(cacheKey, {
        isTranslating: false,
        progress: 100,
        totalNodes: nodesToTranslate.length,
        translatedNodes: translations.size
      });

    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] Translation error:', error);
      nodesToTranslate.forEach(nodeId => {
        translations.set(nodeId, nodeId);
      });
      
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

  // SYNCHRONIZED CACHE KEY GENERATION
  private static generateCacheKey(userId: string, timeRange: string, language: string): string {
    return `${userId}-${timeRange}-${language}-v${this.CACHE_VERSION}`;
  }

  // Defensive cache version and duration checking at time of retrieval
  private static isCacheValid(cached: CachedEnhancedData): boolean {
    const isWithinDuration = (Date.now() - cached.timestamp) < this.CACHE_DURATION;
    const isCorrectVersion = cached.version === this.CACHE_VERSION;
    
    if (!isWithinDuration) {
      console.log(`[EnhancedSoulNetPreloadService] CACHE INVALID (expired): age=${Date.now() - cached.timestamp}ms`);
    }
    if (!isCorrectVersion) {
      console.log(`[EnhancedSoulNetPreloadService] CACHE INVALID (version): ${cached.version} !== ${this.CACHE_VERSION}`);
    }
    
    return isWithinDuration && isCorrectVersion;
  }

  private static setCachedData(cacheKey: string, data: CachedEnhancedData): void {
    this.cache.set(cacheKey, data);
    
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
      console.log(`[EnhancedSoulNetPreloadService] CACHED TO STORAGE: ${cacheKey}`);
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] STORAGE SAVE ERROR:', error);
    }
  }

  // ENHANCED CACHE CLEARING with proper invalidation
  static clearInstantCache(userId?: string): void {
    if (userId) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(userId));
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        localStorage.removeItem(`${this.CACHE_KEY}-${key}`);
        this.translationStates.delete(key);
      });
      
      const coordinatorKeysToDelete = Array.from(this.translationCoordinator.keys()).filter(key => key.startsWith(userId));
      coordinatorKeysToDelete.forEach(key => {
        this.translationCoordinator.delete(key);
      });
    } else {
      this.cache.clear();
      this.translationCoordinator.clear();
      this.translationStates.clear();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.CACHE_KEY)) {
          localStorage.removeItem(key);
        }
      });
    }
  }

  // FIXED: Corrected date calculation logic for proper week calculation
  private static getStartDate(timeRange: string): Date {
    const now = new Date();
    console.log(`[EnhancedSoulNetPreloadService] DATE CALC: Current time: ${now.toISOString()}, Time range: ${timeRange}`);
    
    switch (timeRange) {
      case 'today':
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        console.log(`[EnhancedSoulNetPreloadService] DATE CALC (today): Start of today: ${todayStart.toISOString()}`);
        return todayStart;
        
      case 'week':
        // FIXED: Calculate start of current week (Monday 00:00:00)
        const currentWeekStart = new Date(now);
        const dayOfWeek = currentWeekStart.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days to Monday
        currentWeekStart.setDate(currentWeekStart.getDate() - daysToSubtract);
        currentWeekStart.setHours(0, 0, 0, 0);
        console.log(`[EnhancedSoulNetPreloadService] DATE CALC (week): Day of week: ${dayOfWeek}, Days to subtract: ${daysToSubtract}, Week start: ${currentWeekStart.toISOString()}`);
        return currentWeekStart;
        
      case 'month':
        const monthStart = new Date(now);
        monthStart.setMonth(monthStart.getMonth() - 1);
        console.log(`[EnhancedSoulNetPreloadService] DATE CALC (month): One month ago: ${monthStart.toISOString()}`);
        return monthStart;
        
      case 'year':
        const yearStart = new Date(now);
        yearStart.setFullYear(yearStart.getFullYear() - 1);
        console.log(`[EnhancedSoulNetPreloadService] DATE CALC (year): One year ago: ${yearStart.toISOString()}`);
        return yearStart;
        
      default:
        // Default to last 7 days for unknown time ranges
        const defaultStart = new Date(now);
        defaultStart.setDate(defaultStart.getDate() - 7);
        console.log(`[EnhancedSoulNetPreloadService] DATE CALC (default): Last 7 days: ${defaultStart.toISOString()}`);
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
      const entityY = (entityIndex % 2 === 0) ? 2 : -2;
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
        const pattern = [7, 9, 11];
        const patternIndex = index % 6;
        
        if (patternIndex < 3) {
          return pattern[patternIndex];
        } else {
          return -pattern[patternIndex - 3];
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

    return { nodes, links };
  }
}
