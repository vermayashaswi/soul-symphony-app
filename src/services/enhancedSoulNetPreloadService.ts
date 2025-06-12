import { supabase } from '@/integrations/supabase/client';
import { LanguageLevelTranslationCache } from './languageLevelTranslationCache';

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

// APP-LEVEL: Translation service interface for integration
interface AppLevelTranslationService {
  batchTranslate(options: { texts: string[], targetLanguage: string, sourceLanguage?: string }): Promise<Map<string, string>>;
}

export class EnhancedSoulNetPreloadService {
  private static readonly CACHE_KEY = 'enhanced-soulnet-data';
  private static readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  private static readonly CACHE_VERSION = 8; // Increment for language-level translation fixes
  private static cache = new Map<string, CachedEnhancedData>();
  
  // ENHANCED: Language-level translation state tracking
  private static languageTranslationStates = new Map<string, {
    isTranslating: boolean;
    progress: number;
    isComplete: boolean;
    startedAt: number;
  }>();
  
  // APP-LEVEL: Store reference to app-level translation service
  private static appTranslationService: AppLevelTranslationService | null = null;

  // APP-LEVEL: Method to set the app-level translation service
  static setAppLevelTranslationService(service: AppLevelTranslationService) {
    console.log('[EnhancedSoulNetPreloadService] APP-LEVEL: Setting app-level translation service for language-level coordination');
    this.appTranslationService = service;
    // Also set it for the language-level cache
    LanguageLevelTranslationCache.setAppLevelTranslationService(service);
  }

  // ENHANCED: Get language-level translation state
  static getLanguageTranslationState(userId: string, language: string) {
    const stateKey = `${userId}-${language}`;
    const state = this.languageTranslationStates.get(stateKey);
    
    if (!state) {
      return {
        isTranslating: false,
        progress: 100,
        isComplete: true,
        startedAt: 0
      };
    }
    
    // Check for stale translation states (timeout after 30 seconds)
    const now = Date.now();
    if (state.isTranslating && (now - state.startedAt) > 30000) {
      console.log(`[EnhancedSoulNetPreloadService] LANGUAGE-LEVEL: Translation timeout detected for ${stateKey}, resetting state`);
      this.languageTranslationStates.delete(stateKey);
      return {
        isTranslating: false,
        progress: 100,
        isComplete: true,
        startedAt: 0
      };
    }
    
    return state;
  }

  // ENHANCED: Language-level atomic preload with coordination
  static async preloadInstantData(
    userId: string, 
    timeRange: string, 
    language: string
  ): Promise<EnhancedSoulNetData | null> {
    console.log(`[EnhancedSoulNetPreloadService] LANGUAGE-LEVEL: Starting preload for ${userId}, ${timeRange}, ${language}`);
    
    const cacheKey = this.generateCacheKey(userId, timeRange, language);
    
    // Check for existing graph data cache (time-range specific)
    const cached = this.getInstantData(cacheKey);
    if (cached && cached.data.translationComplete) {
      console.log(`[EnhancedSoulNetPreloadService] LANGUAGE-LEVEL: Using complete cached data for ${cacheKey}`);
      return cached.data;
    }

    try {
      // Fetch raw journal data
      const startDate = this.getStartDate(timeRange);
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('id, themeemotion, "refined text", "transcription text"')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[EnhancedSoulNetPreloadService] LANGUAGE-LEVEL: Error fetching journal entries:', error);
        return null;
      }

      if (!entries || entries.length === 0) {
        console.log('[EnhancedSoulNetPreloadService] LANGUAGE-LEVEL: No entries found, returning empty data');
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

      console.log(`[EnhancedSoulNetPreloadService] LANGUAGE-LEVEL: Processing ${entries.length} entries`);

      // Process the raw data to get graph structure
      const graphData = this.processEntities(entries);
      const uniqueNodes = [...new Set(graphData.nodes.map(node => node.id))];
      
      // Get all unique node texts that need translation (across all time ranges for this user)
      const allUserNodeTexts = await this.getAllUserNodeTexts(userId);
      const allTextsToTranslate = [...new Set([...uniqueNodes, ...allUserNodeTexts])];
      
      console.log(`[EnhancedSoulNetPreloadService] LANGUAGE-LEVEL: Found ${uniqueNodes.length} nodes for ${timeRange}, ${allTextsToTranslate.length} total unique texts for user`);
      
      // ENHANCED: Language-level translation coordination
      const stateKey = `${userId}-${language}`;
      
      // Check if language translations are complete
      const hasCompleteLanguageTranslations = LanguageLevelTranslationCache.hasCompleteTranslations(userId, language);
      
      if (hasCompleteLanguageTranslations) {
        console.log(`[EnhancedSoulNetPreloadService] LANGUAGE-LEVEL: Using existing complete language translations for ${language}`);
        
        // Get translations from language-level cache
        const languageTranslations = LanguageLevelTranslationCache.getLanguageTranslations(userId, language);
        
        // Filter to get only translations for current nodes
        const currentTranslations = new Map<string, string>();
        uniqueNodes.forEach(nodeId => {
          const translation = languageTranslations.get(nodeId) || nodeId;
          currentTranslations.set(nodeId, translation);
        });
        
        // Calculate other data
        const connectionPercentages = new Map<string, number>();
        const nodeConnectionData = new Map<string, NodeConnectionData>();
        this.calculateConnectionPercentages(graphData, connectionPercentages);
        this.calculateNodeConnections(graphData, nodeConnectionData);

        const enhancedData: EnhancedSoulNetData = {
          nodes: graphData.nodes,
          links: graphData.links,
          translations: currentTranslations,
          connectionPercentages,
          nodeConnectionData,
          translationComplete: true,
          translationProgress: 100
        };

        // Cache the complete data for this time range
        this.setCachedData(cacheKey, {
          data: enhancedData,
          timestamp: Date.now(),
          userId,
          timeRange,
          language,
          version: this.CACHE_VERSION
        });

        return enhancedData;
      }
      
      // ENHANCED: Start language-level translation if not complete
      this.languageTranslationStates.set(stateKey, {
        isTranslating: true,
        progress: 0,
        isComplete: false,
        startedAt: Date.now()
      });
      
      console.log(`[EnhancedSoulNetPreloadService] LANGUAGE-LEVEL: Starting language-level translation for ${language}`);
      
      const translationResult = await LanguageLevelTranslationCache.ensureLanguageTranslations(
        userId, 
        language, 
        allTextsToTranslate
      );
      
      // Update language translation state
      this.languageTranslationStates.set(stateKey, {
        isTranslating: false,
        progress: translationResult.progress,
        isComplete: translationResult.isComplete,
        startedAt: 0
      });
      
      // Filter to get only translations for current nodes
      const currentTranslations = new Map<string, string>();
      uniqueNodes.forEach(nodeId => {
        const translation = translationResult.translations.get(nodeId) || nodeId;
        currentTranslations.set(nodeId, translation);
      });

      // Calculate other data
      const connectionPercentages = new Map<string, number>();
      const nodeConnectionData = new Map<string, NodeConnectionData>();
      this.calculateConnectionPercentages(graphData, connectionPercentages);
      this.calculateNodeConnections(graphData, nodeConnectionData);

      const enhancedData: EnhancedSoulNetData = {
        nodes: graphData.nodes,
        links: graphData.links,
        translations: currentTranslations,
        connectionPercentages,
        nodeConnectionData,
        translationComplete: translationResult.isComplete,
        translationProgress: translationResult.progress
      };

      // Cache the data for this time range
      if (translationResult.isComplete) {
        this.setCachedData(cacheKey, {
          data: enhancedData,
          timestamp: Date.now(),
          userId,
          timeRange,
          language,
          version: this.CACHE_VERSION
        });
        console.log(`[EnhancedSoulNetPreloadService] LANGUAGE-LEVEL: Successfully cached complete data for ${cacheKey}`);
      }

      return enhancedData;
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] LANGUAGE-LEVEL: Error in preload:', error);
      // Clear translation state on error
      const stateKey = `${userId}-${language}`;
      this.languageTranslationStates.delete(stateKey);
      return null;
    }
  }

  // ENHANCED: Get all unique node texts for a user (across all time ranges)
  private static async getAllUserNodeTexts(userId: string): Promise<string[]> {
    try {
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('themeemotion')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error || !entries) {
        console.error('[EnhancedSoulNetPreloadService] Error fetching all user entries:', error);
        return [];
      }

      const allTexts = new Set<string>();
      
      entries.forEach(entry => {
        if (!entry.themeemotion) return;
        
        Object.entries(entry.themeemotion).forEach(([entity, emotions]) => {
          if (typeof emotions !== 'object') return;
          
          allTexts.add(entity);
          
          Object.keys(emotions).forEach(emotion => {
            allTexts.add(emotion);
          });
        });
      });

      return Array.from(allTexts);
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] Error getting all user node texts:', error);
      return [];
    }
  }

  static getInstantData(cacheKey: string): CachedEnhancedData | null {
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      console.log(`[EnhancedSoulNetPreloadService] LANGUAGE-LEVEL: Found valid cache for ${cacheKey}`);
      return cached;
    }
    
    // Try localStorage with validation
    try {
      const storedData = localStorage.getItem(`${this.CACHE_KEY}-${cacheKey}`);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if (this.isCacheValid(parsed)) {
          // Convert Maps back from objects with validation
          parsed.data.translations = new Map(Object.entries(parsed.data.translations || {}));
          parsed.data.connectionPercentages = new Map(Object.entries(parsed.data.connectionPercentages || {}));
          parsed.data.nodeConnectionData = new Map(
            Object.entries(parsed.data.nodeConnectionData || {}).map(([key, value]) => [key, value as NodeConnectionData])
          );
          
          parsed.data.translationComplete = parsed.data.translationComplete ?? true;
          parsed.data.translationProgress = parsed.data.translationProgress ?? 100;
          
          this.cache.set(cacheKey, parsed);
          console.log(`[EnhancedSoulNetPreloadService] LANGUAGE-LEVEL: Found valid localStorage cache for ${cacheKey}`);
          return parsed;
        }
      }
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] Error loading from localStorage:', error);
    }
    
    console.log(`[EnhancedSoulNetPreloadService] LANGUAGE-LEVEL: No valid cache found for ${cacheKey}`);
    return null;
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

  // ENHANCED CACHE CLEARING with language-level coordination
  static clearInstantCache(userId?: string): void {
    console.log(`[EnhancedSoulNetPreloadService] LANGUAGE-LEVEL: Clearing cache for user ${userId || 'all users'}`);
    
    if (userId) {
      // Clear specific user's cache including language-level states
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(userId));
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        localStorage.removeItem(`${this.CACHE_KEY}-${key}`);
      });
      
      // Clear language-level translation states for this user
      const languageKeysToDelete = Array.from(this.languageTranslationStates.keys()).filter(key => key.startsWith(userId));
      languageKeysToDelete.forEach(key => {
        this.languageTranslationStates.delete(key);
      });
      
      // Clear language-level cache
      LanguageLevelTranslationCache.clearLanguageCache(userId);
      
      console.log(`[EnhancedSoulNetPreloadService] LANGUAGE-LEVEL: Cleared cache for user ${userId}`);
    } else {
      // Clear all cache
      this.cache.clear();
      this.languageTranslationStates.clear();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.CACHE_KEY)) {
          localStorage.removeItem(key);
        }
      });
      console.log('[EnhancedSoulNetPreloadService] LANGUAGE-LEVEL: Cleared all cache');
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

    console.log("[EnhancedSoulNetPreloadService] APP-LEVEL: Generating graph with", entityList.length, "entities");
    
    // Apply NEW y-axis pattern for entity nodes (circular): +2, -2, +2.25, -2.25, +2.5, -2.5, +2, -2, repeating
    entityList.forEach((entity, entityIndex) => {
      entityNodes.add(entity);
      const entityAngle = (entityIndex / entityList.length) * Math.PI * 2;
      const entityRadius = ENTITY_LAYER_RADIUS;
      const entityX = Math.cos(entityAngle) * entityRadius;
      
      // NEW Y-AXIS PATTERN: +2, -2, +2.25, -2.25, +2.5, -2.5, +2, -2, repeating
      const getEntityYPosition = (index: number): number => {
        const position = index % 8; // 8-position cycle
        
        switch (position) {
          case 0: return 2;     // +2
          case 1: return -2;    // -2
          case 2: return 2.25;  // +2.25
          case 3: return -2.25; // -2.25
          case 4: return 2.5;   // +2.5
          case 5: return -2.5;  // -2.5
          case 6: return 2;     // +2
          case 7: return -2;    // -2
          default: return 2;    // fallback
        }
      };
      
      const entityY = getEntityYPosition(entityIndex);
      const entityZ = Math.sin(entityAngle) * entityRadius;
      
      console.log(`[EnhancedSoulNetPreloadService] NEW Y-POSITIONING: Entity node ${entityIndex + 1} "${entity}" positioned at Y=${entityY}`);
      
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

    // Apply NEW y-axis pattern for emotion nodes (squares): +7, -7, +9, -9, +11, -11, repeating
    Array.from(emotionNodes).forEach((emotion, emotionIndex) => {
      const emotionAngle = (emotionIndex / emotionNodes.size) * Math.PI * 2;
      const emotionRadius = EMOTION_LAYER_RADIUS;
      const emotionX = Math.cos(emotionAngle) * emotionRadius;
      
      // NEW Y-AXIS PATTERN: +7, -7, +9, -9, +11, -11, repeating
      const getEmotionYPosition = (index: number): number => {
        const position = index % 6; // 6-position cycle
        
        switch (position) {
          case 0: return 7;   // +7
          case 1: return -7;  // -7
          case 2: return 9;   // +9
          case 3: return -9;  // -9
          case 4: return 11;  // +11
          case 5: return -11; // -11
          default: return 7;  // fallback
        }
      };
      
      const emotionY = getEmotionYPosition(emotionIndex);
      const emotionZ = Math.sin(emotionAngle) * emotionRadius;
      
      console.log(`[EnhancedSoulNetPreloadService] NEW Y-POSITIONING: Emotion node ${emotionIndex + 1} "${emotion}" positioned at Y=${emotionY}`);
      
      nodes.push({
        id: emotion,
        type: 'emotion',
        value: 0.8,
        color: '#f59e0b', // Golden for emotion nodes (cubes)
        position: [emotionX, emotionY, emotionZ]
      });
    });

    console.log("[EnhancedSoulNetPreloadService] APP-LEVEL: Generated graph with", nodes.length, "nodes and", links.length, "links");
    console.log("[EnhancedSoulNetPreloadService] CUSTOM COLORS: Applied GREEN to entity nodes (spheres) and GOLDEN to emotion nodes (cubes)");
    console.log("[EnhancedSoulNetPreloadService] NEW Y-POSITIONING: Applied +2,-2,+2.25,-2.25,+2.5,-2.5,+2,-2 pattern to entity nodes and +7,-7,+9,-9,+11,-11 pattern to emotion nodes");
    return { nodes, links };
  }
}
