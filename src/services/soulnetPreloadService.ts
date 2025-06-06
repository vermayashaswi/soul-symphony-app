import { supabase } from '@/integrations/supabase/client';
import { translationService } from '@/services/translationService';
import { onDemandTranslationCache } from '@/utils/website-translations';

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

interface ProcessedSoulNetData {
  nodes: NodeData[];
  links: LinkData[];
  translations: Map<string, string>;
  connectionPercentages: Map<string, number>;
}

interface CachedSoulNetData {
  data: ProcessedSoulNetData;
  timestamp: number;
  userId: string;
  timeRange: string;
  language: string;
}

// ENHANCED: Comprehensive node validation utilities
function isValidNodeName(name: string): boolean {
  if (typeof name !== 'string') {
    console.warn(`[SoulNetPreloadService] Non-string node name:`, typeof name, name);
    return false;
  }
  
  const trimmed = name.trim();
  
  // Check for empty or whitespace-only strings
  if (trimmed.length === 0) {
    console.warn(`[SoulNetPreloadService] Empty node name after trim:`, name);
    return false;
  }
  
  // Check for invalid placeholder values
  const invalidValues = ['undefined', 'null', 'NaN', '[object Object]', 'true', 'false'];
  if (invalidValues.includes(trimmed.toLowerCase())) {
    console.warn(`[SoulNetPreloadService] Invalid node name value:`, trimmed);
    return false;
  }
  
  // Check for numeric-only strings (often invalid entities)
  if (/^\d+$/.test(trimmed)) {
    console.warn(`[SoulNetPreloadService] Numeric-only node name:`, trimmed);
    return false;
  }
  
  // Check minimum meaningful length
  if (trimmed.length < 2) {
    console.warn(`[SoulNetPreloadService] Node name too short:`, trimmed);
    return false;
  }
  
  console.log(`[SoulNetPreloadService] Valid node name:`, trimmed);
  return true;
}

function sanitizeNodeName(name: string): string {
  if (!isValidNodeName(name)) {
    const fallback = `Node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.warn(`[SoulNetPreloadService] Invalid node name "${name}", using fallback:`, fallback);
    return fallback;
  }
  return name.trim();
}

function validateAndFilterNodes(nodeNames: string[]): string[] {
  console.log(`[SoulNetPreloadService] Validating ${nodeNames.length} node names`);
  
  const validNodes = nodeNames.filter(name => {
    const isValid = isValidNodeName(name);
    if (!isValid) {
      console.warn(`[SoulNetPreloadService] Filtering out invalid node:`, name);
    }
    return isValid;
  });
  
  console.log(`[SoulNetPreloadService] Validation complete: ${validNodes.length}/${nodeNames.length} nodes are valid`);
  return validNodes;
}

export class SoulNetPreloadService {
  private static readonly CACHE_KEY = 'soulnet-preloaded-data';
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private static cache = new Map<string, CachedSoulNetData>();

  static async preloadSoulNetData(
    userId: string, 
    timeRange: string, 
    language: string
  ): Promise<ProcessedSoulNetData | null> {
    console.log(`[SoulNetPreloadService] Preloading data for user ${userId}, range ${timeRange}, language ${language}`);
    
    const cacheKey = `${userId}-${timeRange}-${language}`;
    const cached = this.getCachedData(cacheKey);
    
    if (cached) {
      console.log(`[SoulNetPreloadService] Using cached data for ${cacheKey}`);
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
        console.error('[SoulNetPreloadService] Error fetching journal entries:', error);
        return null;
      }

      if (!entries || entries.length === 0) {
        console.log('[SoulNetPreloadService] No entries found');
        return { nodes: [], links: [], translations: new Map(), connectionPercentages: new Map() };
      }

      // Process the raw data with enhanced validation
      const graphData = this.processEntities(entries);
      
      // Pre-translate all node names if not English
      const translations = new Map<string, string>();
      const connectionPercentages = new Map<string, number>();
      
      if (language !== 'en') {
        // ENHANCED: Get all valid node names and filter them before translation
        const allNodeNames = graphData.nodes.map(node => node.id);
        const validNodeNames = validateAndFilterNodes(allNodeNames);
        
        if (validNodeNames.length > 0) {
          console.log(`[SoulNetPreloadService] Pre-translating ${validNodeNames.length} valid node names to ${language}`);
          
          try {
            const batchResults = await translationService.batchTranslate({
              texts: validNodeNames,
              targetLanguage: language
            });
            
            batchResults.forEach((translatedText, originalText) => {
              if (translatedText && isValidNodeName(translatedText)) {
                translations.set(originalText, translatedText);
                console.log(`[SoulNetPreloadService] Translation cached: "${originalText}" -> "${translatedText}"`);
              } else {
                console.warn(`[SoulNetPreloadService] Invalid translation result for "${originalText}":`, translatedText);
              }
            });
            
            console.log(`[SoulNetPreloadService] Successfully translated ${translations.size} node names`);
          } catch (translationError) {
            console.error('[SoulNetPreloadService] Translation error:', translationError);
            // Continue without translations rather than failing completely
          }
        } else {
          console.warn('[SoulNetPreloadService] No valid node names to translate');
        }
      }

      // Pre-calculate connection percentages
      this.calculateConnectionPercentages(graphData, connectionPercentages);

      const processedData: ProcessedSoulNetData = {
        nodes: graphData.nodes,
        links: graphData.links,
        translations,
        connectionPercentages
      };

      // Cache the processed data
      this.setCachedData(cacheKey, {
        data: processedData,
        timestamp: Date.now(),
        userId,
        timeRange,
        language
      });

      console.log(`[SoulNetPreloadService] Successfully preloaded and cached data for ${cacheKey} with ${translations.size} translations`);
      return processedData;
    } catch (error) {
      console.error('[SoulNetPreloadService] Error preloading data:', error);
      return null;
    }
  }

  static getCachedDataSync(cacheKey: string): ProcessedSoulNetData | null {
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      console.log(`[SoulNetPreloadService] Found valid cache for ${cacheKey}`);
      return cached.data;
    }
    
    // Try localStorage as fallback
    try {
      const storedData = localStorage.getItem(`${this.CACHE_KEY}-${cacheKey}`);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if ((Date.now() - parsed.timestamp) < this.CACHE_DURATION) {
          // Convert Maps back from objects
          parsed.data.translations = new Map(Object.entries(parsed.data.translations || {}));
          parsed.data.connectionPercentages = new Map(Object.entries(parsed.data.connectionPercentages || {}));
          this.cache.set(cacheKey, parsed);
          console.log(`[SoulNetPreloadService] Found valid localStorage cache for ${cacheKey}`);
          return parsed.data;
        }
      }
    } catch (error) {
      console.error('[SoulNetPreloadService] Error loading from localStorage:', error);
    }
    
    console.log(`[SoulNetPreloadService] No valid cache found for ${cacheKey}`);
    return null;
  }

  private static getCachedData(cacheKey: string): CachedSoulNetData | null {
    const syncResult = this.getCachedDataSync(cacheKey);
    if (syncResult) {
      return this.cache.get(cacheKey) || null;
    }
    return null;
  }

  private static setCachedData(cacheKey: string, data: CachedSoulNetData): void {
    this.cache.set(cacheKey, data);
    
    // Also store in localStorage
    try {
      const storableData = {
        ...data,
        data: {
          ...data.data,
          translations: Object.fromEntries(data.data.translations),
          connectionPercentages: Object.fromEntries(data.data.connectionPercentages)
        }
      };
      localStorage.setItem(`${this.CACHE_KEY}-${cacheKey}`, JSON.stringify(storableData));
    } catch (error) {
      console.error('[SoulNetPreloadService] Error saving to localStorage:', error);
    }
  }

  private static calculateConnectionPercentages(
    graphData: { nodes: NodeData[], links: LinkData[] },
    percentageMap: Map<string, number>
  ): void {
    console.log('[SoulNetPreloadService] Pre-calculating connection percentages');
    
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

    console.log(`[SoulNetPreloadService] Pre-calculated ${percentageMap.size} connection percentages`);
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
    console.log("[SoulNetPreloadService] Processing entities for", entries.length, "entries");
    
    const entityEmotionMap: Record<string, Record<string, number>> = {};
    let invalidEntitiesCount = 0;
    let invalidEmotionsCount = 0;
    
    entries.forEach((entry, entryIndex) => {
      if (!entry.entityemotion) {
        console.log(`[SoulNetPreloadService] Entry ${entryIndex} has no entityemotion data`);
        return;
      }
      
      Object.entries(entry.entityemotion).forEach(([entity, emotions]) => {
        if (typeof emotions !== 'object') {
          console.warn(`[SoulNetPreloadService] Entry ${entryIndex}: emotions not an object for entity "${entity}"`);
          return;
        }
        
        // ENHANCED: Validate and sanitize entity name
        if (!isValidNodeName(entity)) {
          invalidEntitiesCount++;
          console.warn(`[SoulNetPreloadService] Entry ${entryIndex}: Invalid entity name "${entity}" - skipping`);
          return;
        }
        
        const sanitizedEntity = sanitizeNodeName(entity);
        
        if (!entityEmotionMap[sanitizedEntity]) {
          entityEmotionMap[sanitizedEntity] = {};
        }
        
        Object.entries(emotions).forEach(([emotion, score]) => {
          if (typeof score !== 'number') {
            console.warn(`[SoulNetPreloadService] Entry ${entryIndex}: Invalid score for emotion "${emotion}" of entity "${sanitizedEntity}"`);
            return;
          }
          
          // ENHANCED: Validate and sanitize emotion name
          if (!isValidNodeName(emotion)) {
            invalidEmotionsCount++;
            console.warn(`[SoulNetPreloadService] Entry ${entryIndex}: Invalid emotion name "${emotion}" for entity "${sanitizedEntity}" - skipping`);
            return;
          }
          
          const sanitizedEmotion = sanitizeNodeName(emotion);
          
          if (entityEmotionMap[sanitizedEntity][sanitizedEmotion]) {
            entityEmotionMap[sanitizedEntity][sanitizedEmotion] += score;
          } else {
            entityEmotionMap[sanitizedEntity][sanitizedEmotion] = score;
          }
        });
      });
    });

    console.log(`[SoulNetPreloadService] Entity processing complete. Filtered out ${invalidEntitiesCount} invalid entities and ${invalidEmotionsCount} invalid emotions`);
    return this.generateGraph(entityEmotionMap);
  }

  private static generateGraph(entityEmotionMap: Record<string, Record<string, number>>): { nodes: NodeData[], links: LinkData[] } {
    const nodes: NodeData[] = [];
    const links: LinkData[] = [];
    const entityNodes = new Set<string>();
    const emotionNodes = new Set<string>();

    // ENHANCED: Double-check entity names before processing
    const entityList = Object.keys(entityEmotionMap).filter(entity => {
      const isValid = isValidNodeName(entity);
      if (!isValid) {
        console.warn(`[SoulNetPreloadService] Filtering invalid entity from graph generation:`, entity);
      }
      return isValid;
    });
    
    // POSITIONING: Updated emotion Y-pattern and entity radius settings
    const EMOTION_LAYER_RADIUS = 11;
    const ENTITY_LAYER_RADIUS = 6.75; // 75% of previous 9

    // ENTITY Y-PATTERN: +1, -2, +2, -1 repeating
    const ENTITY_Y_PATTERN = [1, -2, 2, -1];

    console.log("[SoulNetPreloadService] ENTITY Y-PATTERN: Implementing +1, -2, +2, -1 repeating pattern for", entityList.length, "valid entities");
    
    entityList.forEach((entity, entityIndex) => {
      entityNodes.add(entity);
      const entityAngle = (entityIndex / entityList.length) * Math.PI * 2;
      const entityRadius = ENTITY_LAYER_RADIUS;
      const entityX = Math.cos(entityAngle) * entityRadius;
      
      // Apply the repeating Y-pattern for entities
      const patternIndex = entityIndex % ENTITY_Y_PATTERN.length;
      const entityY = ENTITY_Y_PATTERN[patternIndex];
      
      // Z-axis uses circular distribution same as X-axis
      const entityZ = Math.sin(entityAngle) * entityRadius;
      
      console.log(`[SoulNetPreloadService] ENTITY Y-PATTERN: Entity ${entity} (index ${entityIndex}) positioned at Y=${entityY} (pattern index: ${patternIndex}, value: ${ENTITY_Y_PATTERN[patternIndex]})`);
      
      nodes.push({
        id: entity,
        type: 'entity',
        value: 1,
        color: '#fff',
        position: [entityX, entityY, entityZ]
      });

      Object.entries(entityEmotionMap[entity]).forEach(([emotion, score]) => {
        // ENHANCED: Double-check emotion names
        if (isValidNodeName(emotion)) {
          emotionNodes.add(emotion);
          links.push({
            source: entity,
            target: emotion,
            value: score
          });
        } else {
          console.warn(`[SoulNetPreloadService] Skipping invalid emotion in graph generation:`, emotion);
        }
      });
    });

    // ENHANCED: Filter valid emotions before processing
    const validEmotions = Array.from(emotionNodes).filter(emotion => {
      const isValid = isValidNodeName(emotion);
      if (!isValid) {
        console.warn(`[SoulNetPreloadService] Filtering invalid emotion from graph generation:`, emotion);
      }
      return isValid;
    });
    
    validEmotions.forEach((emotion, emotionIndex) => {
      const emotionAngle = (emotionIndex / validEmotions.length) * Math.PI * 2;
      const emotionRadius = EMOTION_LAYER_RADIUS;
      const emotionX = Math.cos(emotionAngle) * emotionRadius;
      
      // CORRECTED: New Y-axis pattern for emotions: +7, +9, +11, +13 / -7, -9, -11, -13
      const yPatternValues = [7, 9, 11, 13];
      const patternIndex = emotionIndex % yPatternValues.length;
      const baseY = yPatternValues[patternIndex];
      const emotionY = (emotionIndex % 2 === 0) ? baseY : -baseY;
      
      // Z-axis uses circular distribution (same pattern as X-axis)
      const emotionZ = Math.sin(emotionAngle) * emotionRadius;
      
      console.log(`[SoulNetPreloadService] CORRECTED EMOTION Y-PATTERN: Emotion ${emotion} (index ${emotionIndex}) positioned at Y=${emotionY} (pattern: ${baseY}, positive: ${emotionIndex % 2 === 0})`);
      
      nodes.push({
        id: emotion,
        type: 'emotion',
        value: 0.8,
        color: '#fff',
        position: [emotionX, emotionY, emotionZ]
      });
    });

    console.log("[SoulNetPreloadService] ENHANCED POSITIONING COMPLETE: Generated graph with", nodes.length, "valid nodes and", links.length, "links");
    console.log("[SoulNetPreloadService] ENTITY Y-PATTERN: Repeating +1, -2, +2, -1");
    console.log("[SoulNetPreloadService] EMOTION Y-PATTERN: Corrected to +7,+9,+11,+13 / -7,-9,-11,-13");
    return { nodes, links };
  }

  static clearCache(userId?: string): void {
    if (userId) {
      // Clear specific user's cache
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(userId));
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        localStorage.removeItem(`${this.CACHE_KEY}-${key}`);
      });
      console.log(`[SoulNetPreloadService] Cleared cache for user ${userId}`);
    } else {
      // Clear all cache
      this.cache.clear();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.CACHE_KEY)) {
          localStorage.removeItem(key);
        }
      });
      console.log('[SoulNetPreloadService] Cleared all cache');
    }
  }
}
