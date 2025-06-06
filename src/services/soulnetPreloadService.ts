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

// Simplified node validation
function isValidNodeName(name: string): boolean {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  if (/^\d+$/.test(trimmed)) return false;
  const invalidValues = ['undefined', 'null', 'NaN', '[object Object]', 'true', 'false'];
  return !invalidValues.includes(trimmed.toLowerCase());
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
  const validNodes = nodeNames.filter(isValidNodeName);
  console.log(`[SoulNetPreloadService] Filtered: ${validNodes.length}/${nodeNames.length} valid nodes`);
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

      // Process the raw data with simplified validation
      const graphData = this.processEntities(entries);
      
      // Pre-translate all node names if not English
      const translations = new Map<string, string>();
      const connectionPercentages = new Map<string, number>();
      
      if (language !== 'en') {
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
              }
            });
            
            console.log(`[SoulNetPreloadService] Successfully translated ${translations.size} node names`);
          } catch (translationError) {
            console.error('[SoulNetPreloadService] Translation error:', translationError);
          }
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
      return cached.data;
    }
    
    try {
      const storedData = localStorage.getItem(`${this.CACHE_KEY}-${cacheKey}`);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if ((Date.now() - parsed.timestamp) < this.CACHE_DURATION) {
          parsed.data.translations = new Map(Object.entries(parsed.data.translations || {}));
          parsed.data.connectionPercentages = new Map(Object.entries(parsed.data.connectionPercentages || {}));
          this.cache.set(cacheKey, parsed);
          return parsed.data;
        }
      }
    } catch (error) {
      console.error('[SoulNetPreloadService] Error loading from localStorage:', error);
    }
    
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
      if (!entry.entityemotion) return;
      
      Object.entries(entry.entityemotion).forEach(([entity, emotions]) => {
        if (typeof emotions !== 'object') return;
        
        if (!isValidNodeName(entity)) {
          invalidEntitiesCount++;
          return;
        }
        
        const sanitizedEntity = sanitizeNodeName(entity);
        
        if (!entityEmotionMap[sanitizedEntity]) {
          entityEmotionMap[sanitizedEntity] = {};
        }
        
        Object.entries(emotions).forEach(([emotion, score]) => {
          if (typeof score !== 'number') return;
          
          if (!isValidNodeName(emotion)) {
            invalidEmotionsCount++;
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

    console.log(`[SoulNetPreloadService] Filtered out ${invalidEntitiesCount} invalid entities and ${invalidEmotionsCount} invalid emotions`);
    return this.generateGraph(entityEmotionMap);
  }

  private static generateGraph(entityEmotionMap: Record<string, Record<string, number>>): { nodes: NodeData[], links: LinkData[] } {
    const nodes: NodeData[] = [];
    const links: LinkData[] = [];
    const entityNodes = new Set<string>();
    const emotionNodes = new Set<string>();

    const entityList = Object.keys(entityEmotionMap).filter(isValidNodeName);
    
    // Updated positioning constants
    const EMOTION_LAYER_RADIUS = 11;
    const ENTITY_LAYER_RADIUS = 6.75;
    const ENTITY_Y_PATTERN = [1, -2, 2, -1];

    console.log("[SoulNetPreloadService] Implementing positioning pattern for", entityList.length, "valid entities");
    
    entityList.forEach((entity, entityIndex) => {
      entityNodes.add(entity);
      const entityAngle = (entityIndex / entityList.length) * Math.PI * 2;
      const entityRadius = ENTITY_LAYER_RADIUS;
      const entityX = Math.cos(entityAngle) * entityRadius;
      
      const patternIndex = entityIndex % ENTITY_Y_PATTERN.length;
      const entityY = ENTITY_Y_PATTERN[patternIndex];
      
      const entityZ = Math.sin(entityAngle) * entityRadius;
      
      nodes.push({
        id: entity,
        type: 'entity',
        value: 1,
        color: '#fff',
        position: [entityX, entityY, entityZ]
      });

      Object.entries(entityEmotionMap[entity]).forEach(([emotion, score]) => {
        if (isValidNodeName(emotion)) {
          emotionNodes.add(emotion);
          links.push({
            source: entity,
            target: emotion,
            value: score
          });
        }
      });
    });

    const validEmotions = Array.from(emotionNodes).filter(isValidNodeName);
    
    validEmotions.forEach((emotion, emotionIndex) => {
      const emotionAngle = (emotionIndex / validEmotions.length) * Math.PI * 2;
      const emotionRadius = EMOTION_LAYER_RADIUS;
      const emotionX = Math.cos(emotionAngle) * emotionRadius;
      
      const yPatternValues = [7, 9, 11, 13];
      const patternIndex = emotionIndex % yPatternValues.length;
      const baseY = yPatternValues[patternIndex];
      const emotionY = (emotionIndex % 2 === 0) ? baseY : -baseY;
      
      const emotionZ = Math.sin(emotionAngle) * emotionRadius;
      
      nodes.push({
        id: emotion,
        type: 'emotion',
        value: 0.8,
        color: '#fff',
        position: [emotionX, emotionY, emotionZ]
      });
    });

    console.log("[SoulNetPreloadService] Generated graph with", nodes.length, "valid nodes and", links.length, "links");
    return { nodes, links };
  }

  static clearCache(userId?: string): void {
    if (userId) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(userId));
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        localStorage.removeItem(`${this.CACHE_KEY}-${key}`);
      });
      console.log(`[SoulNetPreloadService] Cleared cache for user ${userId}`);
    } else {
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
