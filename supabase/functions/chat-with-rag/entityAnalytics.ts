
// Entity analytics for the chat-with-rag function

export async function findMentionedEntities(
  supabase: any, 
  userId: string, 
  entityName: string,
  timeRange: { type: string | null, startDate: string | null, endDate: string | null }
) {
  try {
    // Prepare query to find entities in journal entries
    let queryBuilder = supabase
      .from('Journal Entries')
      .select('id, created_at, "refined text", entities, emotions')
      .eq('user_id', userId)
      .not('entities', 'is', null);
    
    // Add time filters if present  
    if (timeRange.startDate) {
      queryBuilder = queryBuilder.gte('created_at', timeRange.startDate);
    }
    
    if (timeRange.endDate) {
      queryBuilder = queryBuilder.lte('created_at', timeRange.endDate);
    }
    
    const { data: entries, error } = await queryBuilder
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching entries with entities:", error);
      return { entries: [], count: 0, error: error.message };
    }
    
    if (!entries || entries.length === 0) {
      return { entries: [], count: 0 };
    }
    
    // Filter entries that mention the entity
    const lowerEntityName = entityName.toLowerCase();
    const matchingEntries = entries.filter((entry: any) => {
      if (!entry.entities || !Array.isArray(entry.entities)) return false;
      
      return entry.entities.some((entity: any) => 
        entity && 
        (entity.name?.toLowerCase().includes(lowerEntityName) || 
         entity.text?.toLowerCase().includes(lowerEntityName))
      );
    });
    
    // Format matching entries
    const formattedEntries = matchingEntries.map((entry: any) => {
      // Find the matching entities
      const matchingEntities = entry.entities.filter((entity: any) => 
        entity && 
        (entity.name?.toLowerCase().includes(lowerEntityName) || 
         entity.text?.toLowerCase().includes(lowerEntityName))
      );
      
      // Extract the dominant emotions if available
      let emotions = null;
      if (entry.emotions) {
        const emotionEntries = Object.entries(entry.emotions);
        if (emotionEntries.length > 0) {
          // Sort emotions by intensity (highest first)
          const topEmotions = emotionEntries
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 3)
            .map(([emotion, intensity]) => ({
              name: emotion,
              score: intensity
            }));
          emotions = topEmotions;
        }
      }
      
      return {
        id: entry.id,
        text: entry["refined text"],
        created_at: entry.created_at,
        entities: matchingEntities,
        emotions
      };
    });
    
    // Additional analytics
    const mentionCount = formattedEntries.length;
    const timeDistribution = {};
    formattedEntries.forEach((entry: any) => {
      const date = new Date(entry.created_at);
      const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
      timeDistribution[monthYear] = (timeDistribution[monthYear] || 0) + 1;
    });
    
    // Analyze emotions associated with this entity
    const entityEmotions = {};
    let totalEmotionEntries = 0;
    
    formattedEntries.forEach((entry: any) => {
      if (entry.emotions) {
        totalEmotionEntries++;
        entry.emotions.forEach((emotion: any) => {
          entityEmotions[emotion.name] = entityEmotions[emotion.name] || { total: 0, count: 0 };
          entityEmotions[emotion.name].total += emotion.score;
          entityEmotions[emotion.name].count += 1;
        });
      }
    });
    
    // Calculate average emotions
    const averageEmotions = Object.entries(entityEmotions).map(([emotion, data]) => ({
      emotion,
      score: (data as any).total / (data as any).count,
      frequency: (data as any).count
    })).sort((a, b) => b.score - a.score);
    
    return { 
      entries: formattedEntries, 
      count: mentionCount,
      entityName,
      summary: {
        mentionCount,
        timeDistribution,
        averageEmotions: averageEmotions.slice(0, 5),
        emotionCoverage: totalEmotionEntries > 0 ? 
          Math.round((totalEmotionEntries / mentionCount) * 100) : 0
      }
    };
  } catch (error: any) {
    console.error("Error finding mentioned entities:", error);
    return { entries: [], count: 0, error: error.message };
  }
}
