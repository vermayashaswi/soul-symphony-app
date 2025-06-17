
interface EntityData {
  type: string;
  name: string;
  text?: string;
}

interface EmotionData {
  name?: string;
  intensity?: number;
}

// FIXED: Updated interface to match what actually comes from Supabase
interface DatabaseJournalEntry {
  id: number;
  entities: any; // Json type from Supabase (can be array, object, or null)
  emotions: any; // Json type from Supabase (can be object, array, or null)
  master_themes?: string[] | null;
  created_at: string;
}

export class SoulNetDataProcessor {
  static processJournalEntries(entries: DatabaseJournalEntry[]): {
    entityCounts: Map<string, number>;
    emotionCounts: Map<string, number>;
    coOccurrences: Map<string, number>;
  } {
    const entityCounts = new Map<string, number>();
    const emotionCounts = new Map<string, number>();
    const coOccurrences = new Map<string, number>();

    entries.forEach(entry => {
      const entryEntities: string[] = [];
      const entryEmotions: string[] = [];

      // ENHANCED: Process entities with fallback to master_themes
      if (entry.entities && Array.isArray(entry.entities)) {
        entry.entities.forEach((entity: any) => {
          if (entity && typeof entity === 'object' && entity.name) {
            const entityName = entity.name.toLowerCase().trim();
            if (entityName && entityName.length > 2) {
              entryEntities.push(entityName);
              entityCounts.set(entityName, (entityCounts.get(entityName) || 0) + 1);
            }
          }
        });
      } else if (entry.master_themes && Array.isArray(entry.master_themes)) {
        // FALLBACK: Use master_themes as synthetic entities when entities are null
        console.log(`[SoulNetDataProcessor] Using master_themes as entities for entry ${entry.id}`);
        entry.master_themes.forEach((theme: string) => {
          if (theme && theme.length > 2) {
            const themeName = theme.toLowerCase().trim();
            entryEntities.push(themeName);
            entityCounts.set(themeName, (entityCounts.get(themeName) || 0) + 1);
          }
        });
      }

      // Process emotions
      if (entry.emotions) {
        if (typeof entry.emotions === 'object' && !Array.isArray(entry.emotions)) {
          // Handle object format {joy: 0.7, sadness: 0.5}
          Object.entries(entry.emotions).forEach(([emotion, intensity]) => {
            if (typeof intensity === 'number' && intensity > 0.2) { // Lowered threshold from 0.3
              const emotionName = emotion.toLowerCase().trim();
              if (emotionName) {
                entryEmotions.push(emotionName);
                emotionCounts.set(emotionName, (emotionCounts.get(emotionName) || 0) + intensity);
              }
            }
          });
        } else if (Array.isArray(entry.emotions)) {
          // Handle array format
          entry.emotions.forEach((emotion: any) => {
            if (emotion && typeof emotion === 'object' && emotion.name && emotion.intensity) {
              const emotionName = emotion.name.toLowerCase().trim();
              const intensity = parseFloat(emotion.intensity);
              if (emotionName && intensity > 0.2) { // Lowered threshold from 0.3
                entryEmotions.push(emotionName);
                emotionCounts.set(emotionName, (emotionCounts.get(emotionName) || 0) + intensity);
              }
            }
          });
        }
      }

      // Calculate co-occurrences within this entry
      const allNodes = [...entryEntities, ...entryEmotions];
      for (let i = 0; i < allNodes.length; i++) {
        for (let j = i + 1; j < allNodes.length; j++) {
          const node1 = allNodes[i];
          const node2 = allNodes[j];
          if (node1 !== node2) {
            const key = [node1, node2].sort().join('|');
            coOccurrences.set(key, (coOccurrences.get(key) || 0) + 1);
          }
        }
      }

      // DEBUGGING: Log processing for this entry
      if (entryEntities.length > 0 || entryEmotions.length > 0) {
        console.log(`[SoulNetDataProcessor] Entry ${entry.id}: ${entryEntities.length} entities, ${entryEmotions.length} emotions`);
      }
    });

    console.log(`[SoulNetDataProcessor] Final counts: ${entityCounts.size} unique entities, ${emotionCounts.size} unique emotions, ${coOccurrences.size} co-occurrences`);
    
    return { entityCounts, emotionCounts, coOccurrences };
  }

  static generateNodePositions(totalNodes: number, index: number): [number, number, number] {
    const angle = (index * 2 * Math.PI) / Math.max(totalNodes, 8);
    const radius = Math.min(15 + totalNodes * 0.5, 25); // Dynamic radius based on node count
    const heightVariation = (Math.random() - 0.5) * 8; // Less random height variation
    
    return [
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      heightVariation
    ];
  }

  static filterSignificantNodes(
    entityCounts: Map<string, number>,
    emotionCounts: Map<string, number>,
    minEntityCount: number = 1, // Lowered from 2
    minEmotionIntensity: number = 0.5 // Lowered from 1.0
  ): { entities: Map<string, number>; emotions: Map<string, number> } {
    const filteredEntities = new Map<string, number>();
    const filteredEmotions = new Map<string, number>();

    entityCounts.forEach((count, entity) => {
      if (count >= minEntityCount) {
        filteredEntities.set(entity, count);
      }
    });

    emotionCounts.forEach((intensity, emotion) => {
      if (intensity >= minEmotionIntensity) {
        filteredEmotions.set(emotion, intensity);
      }
    });

    console.log(`[SoulNetDataProcessor] Filtering results: ${filteredEntities.size}/${entityCounts.size} entities, ${filteredEmotions.size}/${emotionCounts.size} emotions kept`);

    return { entities: filteredEntities, emotions: filteredEmotions };
  }
}
