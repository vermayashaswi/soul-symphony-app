import { supabase } from '@/integrations/supabase/client';
import { translationService } from './translationService';

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

interface SoulNetGraphData {
  nodes: NodeData[];
  links: LinkData[];
}

interface TranslationResult {
  [key: string]: string;
}

class SoulNetPreloadServiceClass {
  private cache = new Map<string, any>();
  private translationPromises = new Map<string, Promise<Map<string, string>>>();

  async preloadData(userId: string, timeRange: string, targetLanguage?: string): Promise<any> {
    const cacheKey = `${userId}-${timeRange}-${targetLanguage || 'en'}`;
    
    if (this.cache.has(cacheKey)) {
      console.log('[SoulNetPreloadService] Using cached data for', cacheKey);
      return this.cache.get(cacheKey);
    }

    try {
      console.log('[SoulNetPreloadService] Fetching and processing data for', cacheKey);
      
      // Get base data first
      const baseData = await this.fetchSoulNetData(userId, timeRange);
      if (!baseData) {
        console.log('[SoulNetPreloadService] No base data available');
        return null;
      }

      // Process translations if needed
      if (targetLanguage && targetLanguage !== 'en') {
        console.log('[SoulNetPreloadService] Processing translations for', targetLanguage);
        const nodeTexts = [...new Set(baseData.nodes.map(node => node.id))];
        
        // FIXED: Use correct batchTranslate API
        const translations = await translationService.batchTranslate(
          nodeTexts,
          'en',
          targetLanguage
        );

        const processedData = {
          ...baseData,
          translations: translations,
          translationComplete: true
        };

        this.cache.set(cacheKey, processedData);
        console.log('[SoulNetPreloadService] Data processed and cached for', cacheKey);
        return processedData;
      }

      // No translation needed
      const processedData = {
        ...baseData,
        translations: new Map(),
        translationComplete: true
      };

      this.cache.set(cacheKey, processedData);
      return processedData;
    } catch (error) {
      console.error('[SoulNetPreloadService] Error preloading data:', error);
      return null;
    }
  }

  private async fetchSoulNetData(userId: string, timeRange: string): Promise<SoulNetGraphData | null> {
    console.log(`[SoulNetPreloadService] Fetching SoulNet data for user ${userId}, range ${timeRange}`);
    
    try {
      // Fetch data from Supabase or your data source
      // Replace this with your actual data fetching logic
      const startDate = this.getStartDate(timeRange);
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('id, themeemotion, "refined text", "transcription text"')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[SoulNetPreloadService] Error fetching journal entries:', error);
        return null;
      }

      if (!entries || entries.length === 0) {
        console.log('[SoulNetPreloadService] No entries found');
        return { nodes: [], links: [] };
      }

      console.log(`[SoulNetPreloadService] Found ${entries.length} entries for processing`);

      // Process the raw data
      const graphData = this.processEntities(entries);
      return graphData;
    } catch (error) {
      console.error('[SoulNetPreloadService] Error fetching data:', error);
      return null;
    }
  }

  private getStartDate(timeRange: string): Date {
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

  private processEntities(entries: any[]): SoulNetGraphData {
    console.log("[SoulNetPreloadService] Processing entities for", entries.length, "entries");
    
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

  private generateGraph(entityEmotionMap: Record<string, Record<string, number>>): SoulNetGraphData {
    const nodes: NodeData[] = [];
    const links: LinkData[] = [];
    const entityNodes = new Set<string>();
    const emotionNodes = new Set<string>();

    const entityList = Object.keys(entityEmotionMap);
    const EMOTION_LAYER_RADIUS = 11;
    const ENTITY_LAYER_RADIUS = 6;
    const EMOTION_Y_SPAN = 6;
    const ENTITY_Y_SPAN = 3;

    console.log("[SoulNetPreloadService] Generating graph with", entityList.length, "entities");
    
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
      const emotionY = ((emotionIndex % 2) === 0 ? -1 : 1) * 0.7 * (Math.random() - 0.5) * EMOTION_Y_SPAN;
      const emotionZ = Math.sin(emotionAngle) * emotionRadius;
      
      nodes.push({
        id: emotion,
        type: 'emotion',
        value: 0.8,
        color: '#fff',
        position: [emotionX, emotionY, emotionZ]
      });
    });

    console.log("[SoulNetPreloadService] Generated graph with", nodes.length, "nodes and", links.length);
    return { nodes, links };
  }

  clearCache(userId?: string): void {
    if (userId) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(userId));
      keysToDelete.forEach(key => this.cache.delete(key));
      console.log(`[SoulNetPreloadService] Cleared cache for user ${userId}`);
    } else {
      this.cache.clear();
      this.translationPromises.clear();
      console.log('[SoulNetPreloadService] Cleared all cache');
    }
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

export const SoulNetPreloadService = new SoulNetPreloadServiceClass();
