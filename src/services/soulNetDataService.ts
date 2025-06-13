
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

interface SoulNetGraphData {
  nodes: NodeData[];
  links: LinkData[];
}

class SoulNetDataService {
  async getSoulNetData(userId: string, timeRange: string): Promise<SoulNetGraphData | null> {
    console.log(`[SoulNetDataService] Fetching data for user ${userId}, range ${timeRange}`);
    
    try {
      // Fetch raw journal data - FIXED: Use themeemotion instead of entityemotion
      const startDate = this.getStartDate(timeRange);
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('id, themeemotion, "refined text", "transcription text"')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[SoulNetDataService] Error fetching journal entries:', error);
        return null;
      }

      if (!entries || entries.length === 0) {
        console.log('[SoulNetDataService] No entries found');
        return { nodes: [], links: [] };
      }

      console.log(`[SoulNetDataService] Found ${entries.length} entries for processing`);

      // Process the raw data
      const graphData = this.processEntities(entries);
      return graphData;
    } catch (error) {
      console.error('[SoulNetDataService] Error fetching data:', error);
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
    console.log("[SoulNetDataService] Processing entities for", entries.length, "entries");
    
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

    console.log("[SoulNetDataService] Generating graph with", entityList.length, "entities");
    
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

    console.log("[SoulNetDataService] Generated graph with", nodes.length, "nodes and", links.length, "links");
    return { nodes, links };
  }
}

export const soulNetDataService = new SoulNetDataService();
