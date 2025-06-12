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

// APP-LEVEL: Translation service interface for integration
interface AppLevelTranslationService {
  batchTranslate(options: { texts: string[], targetLanguage: string, sourceLanguage?: string }): Promise<Map<string, string>>;
}

export class EnhancedSoulNetPreloadService {
  private static readonly CACHE_KEY = 'enhanced-soulnet-data';
  private static readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  private static readonly CACHE_VERSION = 8; // UPDATED: Increment for spherical distribution changes
  private static cache = new Map<string, CachedEnhancedData>();
  private static translationCoordinator = new Map<string, Promise<Map<string, string>>>();
  
  // ENHANCED: Atomic translation state tracking with better coordination
  private static translationStates = new Map<string, {
    isTranslating: boolean;
    progress: number;
    totalNodes: number;
    translatedNodes: number;
    isAtomic: boolean; // NEW: Track if translation should be atomic
    startedAt: number; // NEW: Track when translation started
  }>();
  
  // APP-LEVEL: Store reference to app-level translation service
  private static appTranslationService: AppLevelTranslationService | null = null;

  // NEW: Seeded random number generator for deterministic positioning
  private static seededRandom(seed: number) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  // NEW: Generate hash from string for consistent seeding
  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // NEW: Generate spherical distribution for entity nodes
  private static generateSphericalPosition(entityId: string, index: number, radius: number = 6): [number, number, number] {
    // Create deterministic seed from entity ID and index
    const seed = this.hashString(entityId) + index * 1000;
    
    // Generate three random numbers for spherical coordinates
    const u = this.seededRandom(seed);
    const v = this.seededRandom(seed + 1);
    const w = this.seededRandom(seed + 2);
    
    // Convert to spherical coordinates with uniform distribution
    const theta = 2 * Math.PI * u; // Azimuthal angle (0 to 2π)
    const phi = Math.acos(2 * v - 1); // Polar angle (0 to π) with uniform distribution
    const r = Math.cbrt(w) * radius; // Radial distance with cubic root for uniform volume distribution
    
    // Convert spherical to Cartesian coordinates
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    
    console.log(`[EnhancedSoulNetPreloadService] SPHERICAL DISTRIBUTION: Entity "${entityId}" positioned at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}) with radius ${r.toFixed(2)}`);
    
    return [x, y, z];
  }

  // NEW: Enforce minimum distance between nodes
  private static enforceMinimumDistance(
    positions: Map<string, [number, number, number]>, 
    entityId: string, 
    newPosition: [number, number, number], 
    minDistance: number = 2.5
  ): [number, number, number] {
    let attempts = 0;
    let finalPosition = newPosition;
    
    while (attempts < 50) { // Limit attempts to prevent infinite loops
      let tooClose = false;
      
      for (const [otherEntityId, otherPosition] of positions.entries()) {
        if (otherEntityId === entityId) continue;
        
        const distance = Math.sqrt(
          Math.pow(finalPosition[0] - otherPosition[0], 2) +
          Math.pow(finalPosition[1] - otherPosition[1], 2) +
          Math.pow(finalPosition[2] - otherPosition[2], 2)
        );
        
        if (distance < minDistance) {
          tooClose = true;
          break;
        }
      }
      
      if (!tooClose) {
        break;
      }
      
      // Generate new position with slightly different seed
      attempts++;
      const seed = this.hashString(entityId) + attempts * 100;
      const u = this.seededRandom(seed);
      const v = this.seededRandom(seed + 1);
      const w = this.seededRandom(seed + 2);
      
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = Math.cbrt(w) * 6; // Keep radius at 6
      
      finalPosition = [
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      ];
    }
    
    if (attempts > 0) {
      console.log(`[EnhancedSoulNetPreloadService] MINIMUM DISTANCE: Adjusted position for "${entityId}" after ${attempts} attempts`);
    }
    
    return finalPosition;
  }

  // APP-LEVEL: Method to set the app-level translation service
  static setAppLevelTranslationService(service: AppLevelTranslationService) {
    console.log('[EnhancedSoulNetPreloadService] APP-LEVEL: Setting app-level translation service for atomic coordination');
    this.appTranslationService = service;
  }

  // ENHANCED: Get translation state with atomic coordination checks
  static getTranslationState(cacheKey: string) {
    const state = this.translationStates.get(cacheKey);
    if (!state) {
      return {
        isTranslating: false,
        progress: 100,
        totalNodes: 0,
        translatedNodes: 0,
        isAtomic: true,
        startedAt: 0
      };
    }
    
    // ENHANCED: Check for stale translation states (timeout after 30 seconds)
    const now = Date.now();
    if (state.isTranslating && (now - state.startedAt) > 30000) {
      console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Translation timeout detected for ${cacheKey}, resetting state`);
      this.translationStates.delete(cacheKey);
      return {
        isTranslating: false,
        progress: 100,
        totalNodes: state.totalNodes,
        translatedNodes: state.totalNodes,
        isAtomic: true,
        startedAt: 0
      };
    }
    
    return state;
  }

  // ENHANCED: Atomic preload with coordinated translation
  static async preloadInstantData(
    userId: string, 
    timeRange: string, 
    language: string
  ): Promise<EnhancedSoulNetData | null> {
    console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Starting atomic preload for ${userId}, ${timeRange}, ${language}`);
    
    const cacheKey = this.generateCacheKey(userId, timeRange, language);
    
    // ENHANCED: Clear any stale cache on language change for fresh atomic translation
    const existingCache = this.cache.get(cacheKey);
    if (existingCache && existingCache.language !== language) {
      console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Language change detected, clearing cache for atomic fresh translation`);
      this.clearInstantCache(userId);
    }
    
    // ENHANCED: Check for complete atomic translation
    const cached = this.getInstantData(cacheKey);
    if (cached && cached.data.translationComplete) {
      console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Using complete cached atomic translation for ${cacheKey}`);
      return cached.data;
    }

    try {
      // Fetch raw journal data with enhanced error handling
      const startDate = this.getStartDate(timeRange);
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('id, themeemotion, "refined text", "transcription text"')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[EnhancedSoulNetPreloadService] ATOMIC: Error fetching journal entries:', error);
        return null;
      }

      if (!entries || entries.length === 0) {
        console.log('[EnhancedSoulNetPreloadService] ATOMIC: No entries found, returning empty atomic data');
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

      console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Processing ${entries.length} entries with atomic translation coordination`);

      // Process the raw data
      const graphData = this.processEntities(entries);
      
      // ENHANCED: Initialize atomic translation state
      const uniqueNodes = [...new Set(graphData.nodes.map(node => node.id))];
      const isEnglish = language === 'en';
      
      this.translationStates.set(cacheKey, {
        isTranslating: !isEnglish && uniqueNodes.length > 0,
        progress: isEnglish ? 100 : 0,
        totalNodes: uniqueNodes.length,
        translatedNodes: isEnglish ? uniqueNodes.length : 0,
        isAtomic: true, // Force atomic behavior
        startedAt: Date.now()
      });

      // ENHANCED: Atomic coordinated translation
      const translations = await this.getAtomicCoordinatedTranslations(graphData.nodes, language, cacheKey);
      const connectionPercentages = new Map<string, number>();
      const nodeConnectionData = new Map<string, NodeConnectionData>();
      
      // Pre-calculate connection data
      this.calculateConnectionPercentages(graphData, connectionPercentages);
      this.calculateNodeConnections(graphData, nodeConnectionData);

      // ENHANCED: Determine atomic completion
      const isTranslationComplete = isEnglish || translations.size === uniqueNodes.length;
      const translationProgress = isEnglish ? 100 : Math.round((translations.size / uniqueNodes.length) * 100);

      // ENHANCED: Update atomic translation state
      this.translationStates.set(cacheKey, {
        isTranslating: false,
        progress: translationProgress,
        totalNodes: uniqueNodes.length,
        translatedNodes: translations.size,
        isAtomic: true,
        startedAt: 0
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

      // ENHANCED: Only cache when atomic translation is complete
      if (isTranslationComplete) {
        this.setCachedData(cacheKey, {
          data: enhancedData,
          timestamp: Date.now(),
          userId,
          timeRange,
          language,
          version: this.CACHE_VERSION
        });
        console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Successfully cached complete atomic translation for ${cacheKey}`);
      } else {
        console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Translation incomplete, maintaining consistency for ${cacheKey}`);
      }

      return enhancedData;
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] ATOMIC: Error in atomic preload:', error);
      // Clear translation state on error
      this.translationStates.delete(cacheKey);
      return null;
    }
  }

  // ENHANCED: Instant data access with atomic coordination
  static getInstantData(cacheKey: string): CachedEnhancedData | null {
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Found valid atomic cache for ${cacheKey}`);
      return cached;
    }
    
    // ENHANCED: Try localStorage with atomic validation
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
          
          // ENHANCED: Ensure atomic translation fields have proper defaults
          parsed.data.translationComplete = parsed.data.translationComplete ?? true;
          parsed.data.translationProgress = parsed.data.translationProgress ?? 100;
          
          this.cache.set(cacheKey, parsed);
          console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Found valid localStorage atomic cache for ${cacheKey}`);
          return parsed;
        }
      }
    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] ATOMIC: Error loading from localStorage:', error);
    }
    
    console.log(`[EnhancedSoulNetPreloadService] ATOMIC: No valid atomic cache found for ${cacheKey}`);
    return null;
  }

  // ENHANCED: Atomic coordinated translation with timeout protection
  private static async getAtomicCoordinatedTranslations(
    nodes: NodeData[], 
    language: string, 
    cacheKey: string
  ): Promise<Map<string, string>> {
    if (language === 'en') {
      const translations = new Map<string, string>();
      nodes.forEach(node => translations.set(node.id, node.id));
      console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Using English nodes directly for atomic consistency`);
      return translations;
    }

    // ENHANCED: Check for existing atomic translation in progress
    const existingTranslation = this.translationCoordinator.get(cacheKey);
    if (existingTranslation) {
      console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Waiting for existing atomic translation for ${cacheKey}`);
      try {
        // Add timeout protection for atomic coordination
        return await Promise.race([
          existingTranslation,
          new Promise<Map<string, string>>((_, reject) => 
            setTimeout(() => reject(new Error('Atomic translation timeout')), 25000)
          )
        ]);
      } catch (error) {
        console.error(`[EnhancedSoulNetPreloadService] ATOMIC: Existing translation failed for ${cacheKey}:`, error);
        this.translationCoordinator.delete(cacheKey);
      }
    }

    // ENHANCED: Start new atomic coordinated translation
    const translationPromise = this.performAtomicBatchTranslation(nodes, language, cacheKey);
    this.translationCoordinator.set(cacheKey, translationPromise);

    try {
      const result = await translationPromise;
      console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Completed atomic coordinated translation for ${cacheKey}`);
      return result;
    } finally {
      // Clean up coordinator
      this.translationCoordinator.delete(cacheKey);
    }
  }

  // ENHANCED: Atomic batch translation with complete error handling
  private static async performAtomicBatchTranslation(nodes: NodeData[], language: string, cacheKey: string): Promise<Map<string, string>> {
    const translations = new Map<string, string>();
    const nodesToTranslate = [...new Set(nodes.map(node => node.id))];
    
    console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Starting atomic batch translation ${nodesToTranslate.length} unique nodes to ${language}`);
    
    // ENHANCED: Update atomic translation state with progress tracking
    this.translationStates.set(cacheKey, {
      isTranslating: true,
      progress: 0,
      totalNodes: nodesToTranslate.length,
      translatedNodes: 0,
      isAtomic: true,
      startedAt: Date.now()
    });
    
    try {
      if (!this.appTranslationService) {
        console.warn('[EnhancedSoulNetPreloadService] ATOMIC: No app-level translation service available, using atomic fallback');
        
        // ENHANCED: Atomic fallback with all original text
        nodesToTranslate.forEach(nodeId => {
          translations.set(nodeId, nodeId);
        });
        
        // Update atomic completion state
        this.translationStates.set(cacheKey, {
          isTranslating: false,
          progress: 100,
          totalNodes: nodesToTranslate.length,
          translatedNodes: nodesToTranslate.length,
          isAtomic: true,
          startedAt: 0
        });
        
        return translations;
      }

      // ENHANCED: Perform atomic batch translation with explicit coordination
      console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Using app-level service for atomic translation from 'en' to '${language}'`);
      
      const batchResults = await this.appTranslationService.batchTranslate({
        texts: nodesToTranslate,
        targetLanguage: language,
        sourceLanguage: 'en'
      });
      
      console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Atomic batch translation completed ${batchResults.size}/${nodesToTranslate.length} nodes`);
      
      // ENHANCED: Process atomic results with strict validation
      batchResults.forEach((translatedText, originalText) => {
        if (translatedText && translatedText.trim() !== '') {
          translations.set(originalText, translatedText);
          console.log(`[EnhancedSoulNetPreloadService] ATOMIC: ✓ "${originalText}" -> "${translatedText}"`);
        } else {
          console.warn(`[EnhancedSoulNetPreloadService] ATOMIC: ⚠ Empty atomic translation for "${originalText}", using original`);
          translations.set(originalText, originalText);
        }
      });

      // ENHANCED: Ensure atomic completeness - handle any missing translations
      nodesToTranslate.forEach(nodeId => {
        if (!translations.has(nodeId)) {
          console.warn(`[EnhancedSoulNetPreloadService] ATOMIC: ⚠ No atomic translation found for node: "${nodeId}", using original`);
          translations.set(nodeId, nodeId);
        }
      });

      // ENHANCED: Update atomic completion state
      this.translationStates.set(cacheKey, {
        isTranslating: false,
        progress: 100,
        totalNodes: nodesToTranslate.length,
        translatedNodes: translations.size,
        isAtomic: true,
        startedAt: 0
      });

      console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Translation summary - Total: ${nodesToTranslate.length}, Translated: ${translations.size}, Atomic success rate: ${Math.round((translations.size / nodesToTranslate.length) * 100)}%`);

    } catch (error) {
      console.error('[EnhancedSoulNetPreloadService] ATOMIC: Error during atomic batch translation:', error);
      
      // ENHANCED: Atomic fallback with complete original text coverage
      nodesToTranslate.forEach(nodeId => {
        translations.set(nodeId, nodeId);
      });
      
      // Update atomic error state
      this.translationStates.set(cacheKey, {
        isTranslating: false,
        progress: 100,
        totalNodes: nodesToTranslate.length,
        translatedNodes: nodesToTranslate.length,
        isAtomic: true,
        startedAt: 0
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

  // ENHANCED CACHE CLEARING with proper invalidation
  static clearInstantCache(userId?: string): void {
    console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Clearing atomic cache for user ${userId || 'all users'}`);
    
    if (userId) {
      // Clear specific user's cache including atomic states
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(userId));
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        localStorage.removeItem(`${this.CACHE_KEY}-${key}`);
        this.translationStates.delete(key);
      });
      
      // Clear atomic translation coordinator for this user
      const coordinatorKeysToDelete = Array.from(this.translationCoordinator.keys()).filter(key => key.startsWith(userId));
      coordinatorKeysToDelete.forEach(key => {
        this.translationCoordinator.delete(key);
      });
      
      console.log(`[EnhancedSoulNetPreloadService] ATOMIC: Cleared atomic cache for user ${userId}`);
    } else {
      // Clear all atomic cache
      this.cache.clear();
      this.translationCoordinator.clear();
      this.translationStates.clear();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.CACHE_KEY)) {
          localStorage.removeItem(key);
        }
      });
      console.log('[EnhancedSoulNetPreloadService] ATOMIC: Cleared all atomic cache');
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
      // FIXED: Use themeemotion instead of entityemotion
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
    const ENTITY_SPHERE_RADIUS = 6; // UPDATED: Use for spherical distribution

    console.log("[EnhancedSoulNetPreloadService] SPHERICAL DISTRIBUTION: Generating graph with", entityList.length, "entities using spherical distribution");
    
    // UPDATED: Track entity positions for minimum distance enforcement
    const entityPositions = new Map<string, [number, number, number]>();
    
    // UPDATED: Generate spherically distributed entity nodes
    entityList.forEach((entity, entityIndex) => {
      entityNodes.add(entity);
      
      // Generate initial spherical position
      let entityPosition = this.generateSphericalPosition(entity, entityIndex, ENTITY_SPHERE_RADIUS);
      
      // Enforce minimum distance from other entities
      entityPosition = this.enforceMinimumDistance(entityPositions, entity, entityPosition);
      
      // Store the final position
      entityPositions.set(entity, entityPosition);
      
      console.log(`[EnhancedSoulNetPreloadService] SPHERICAL POSITIONING: Entity node ${entityIndex + 1} "${entity}" positioned at (${entityPosition[0].toFixed(2)}, ${entityPosition[1].toFixed(2)}, ${entityPosition[2].toFixed(2)})`);
      
      nodes.push({
        id: entity,
        type: 'entity',
        value: 1,
        color: '#22c55e', // Green for entity nodes (spheres)
        position: entityPosition
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

    // UPDATED: Keep emotion nodes in circular pattern with NEW y-axis pattern
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
      
      console.log(`[EnhancedSoulNetPreloadService] CIRCULAR POSITIONING: Emotion node ${emotionIndex + 1} "${emotion}" positioned at Y=${emotionY}`);
      
      nodes.push({
        id: emotion,
        type: 'emotion',
        value: 0.8,
        color: '#f59e0b', // Golden for emotion nodes (cubes)
        position: [emotionX, emotionY, emotionZ]
      });
    });

    console.log("[EnhancedSoulNetPreloadService] HYBRID POSITIONING: Generated graph with", nodes.length, "nodes and", links.length, "links");
    console.log("[EnhancedSoulNetPreloadService] SPHERICAL ENTITIES: Applied spherical distribution to", entityList.length, "entity nodes within radius", ENTITY_SPHERE_RADIUS);
    console.log("[EnhancedSoulNetPreloadService] CIRCULAR EMOTIONS: Applied +7,-7,+9,-9,+11,-11 pattern to emotion nodes");
    return { nodes, links };
  }
}
