
interface EntityData {
  type: string;
  name: string;
  text?: string;
}

interface EmotionData {
  name?: string;
  intensity?: number;
}

interface JournalEntry {
  id: number;
  entities: EntityData[] | null;
  emotions: Record<string, number> | EmotionData[] | null;
  created_at: string;
}

export class SoulNetDataProcessor {
  static processJournalEntries(entries: JournalEntry[]): {
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

      // Process entities
      if (entry.entities && Array.isArray(entry.entities)) {
        entry.entities.forEach((entity: any) => {
          if (entity && typeof entity === 'object' && entity.name) {
            const entityName = entity.name.toLowerCase().trim();
            if (entityName && entityName.length > 2) { // Filter out very short names
              entryEntities.push(entityName);
              entityCounts.set(entityName, (entityCounts.get(entityName) || 0) + 1);
            }
          }
        });
      }

      // Process emotions
      if (entry.emotions) {
        if (typeof entry.emotions === 'object' && !Array.isArray(entry.emotions)) {
          // Handle object format {joy: 0.7, sadness: 0.5}
          Object.entries(entry.emotions).forEach(([emotion, intensity]) => {
            if (typeof intensity === 'number' && intensity > 0.3) {
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
              if (emotionName && intensity > 0.3) {
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
    });

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
    minEntityCount: number = 2,
    minEmotionIntensity: number = 1.0
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

    return { entities: filteredEntities, emotions: filteredEmotions };
  }
}
