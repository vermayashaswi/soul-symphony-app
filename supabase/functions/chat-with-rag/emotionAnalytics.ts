
// Emotion analytics for the chat-with-rag function

export async function calculateTopEmotions(
  supabase: any, 
  userId: string, 
  timeRange: { type: string | null, startDate: string | null, endDate: string | null },
  limit: number = 5
): Promise<{ topEmotions: any[], entryCount: number, error?: string }> {
  try {
    // Build query based on provided time range
    let queryBuilder = supabase
      .from('Journal Entries')
      .select('emotions, created_at')
      .eq('user_id', userId)
      .not('emotions', 'is', null);
      
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
      console.error("Error fetching entries for emotion analysis:", error);
      return { topEmotions: [], entryCount: 0, error: error.message };
    }
    
    if (!entries || entries.length === 0) {
      return { topEmotions: [], entryCount: 0 };
    }
    
    // Aggregate emotions across all entries
    const emotionScores: Record<string, {total: number, count: number}> = {};
    
    entries.forEach((entry: any) => {
      if (entry.emotions) {
        Object.entries(entry.emotions).forEach(([emotion, score]) => {
          if (!emotionScores[emotion]) {
            emotionScores[emotion] = { total: 0, count: 0 };
          }
          emotionScores[emotion].total += parseFloat(score as string);
          emotionScores[emotion].count += 1;
        });
      }
    });
    
    // Calculate average for each emotion and sort
    const averagedEmotions = Object.entries(emotionScores)
      .map(([emotion, data]) => ({
        emotion,
        score: data.total / data.count,
        frequency: data.count,
        formattedScore: `${Math.round((data.total / data.count) * 100)}%`
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    // Split into positive and negative emotions
    const positiveEmotions = ['happiness', 'joy', 'gratitude', 'satisfaction', 'contentment', 'love'];
    const negativeEmotions = ['sadness', 'anger', 'fear', 'anxiety', 'frustration', 'disappointment'];
    
    const groupedEmotions = {
      positive: averagedEmotions.filter(e => positiveEmotions.includes(e.emotion.toLowerCase())),
      negative: averagedEmotions.filter(e => negativeEmotions.includes(e.emotion.toLowerCase())),
      other: averagedEmotions.filter(e => 
        !positiveEmotions.includes(e.emotion.toLowerCase()) && 
        !negativeEmotions.includes(e.emotion.toLowerCase())
      )
    };
    
    return { 
      topEmotions: averagedEmotions, 
      groupedEmotions,
      entryCount: entries.length 
    };
  } catch (error: any) {
    console.error("Error calculating top emotions:", error);
    return { topEmotions: [], entryCount: 0, error: error.message };
  }
}

export async function getEmotionalInsights(
  supabase: any, 
  userId: string, 
  timeRange: { type: string | null, startDate: string | null, endDate: string | null },
  targetEmotion?: string
) {
  try {
    // Get top emotions
    const { topEmotions, groupedEmotions, entryCount } = await calculateTopEmotions(
      supabase, 
      userId, 
      timeRange
    );
    
    // If a specific emotion is targeted, get entries with high scores for that emotion
    let emotionHighlights = null;
    if (targetEmotion) {
      // Make function name lowercase for querying
      const lowerEmotionName = targetEmotion.toLowerCase();
      
      let queryBuilder = supabase
        .from('Journal Entries')
        .select('id, created_at, "refined text", emotions')
        .eq('user_id', userId)
        .not('emotions', 'is', null);
        
      // Add time filters if present  
      if (timeRange.startDate) {
        queryBuilder = queryBuilder.gte('created_at', timeRange.startDate);
      }
      
      if (timeRange.endDate) {
        queryBuilder = queryBuilder.lte('created_at', timeRange.endDate);
      }
      
      const { data: entries, error } = await queryBuilder
        .order('created_at', { ascending: false });
      
      if (!error && entries && entries.length > 0) {
        // Filter and sort entries by target emotion score
        const entriesWithTargetEmotion = entries
          .filter((entry: any) => 
            entry.emotions && 
            Object.keys(entry.emotions).some(key => 
              key.toLowerCase() === lowerEmotionName &&
              entry.emotions[key] > 0.3 // Only include significant scores
            )
          )
          .map((entry: any) => {
            // Find the emotion key that matches our target (case insensitive)
            const matchingKey = Object.keys(entry.emotions).find(
              key => key.toLowerCase() === lowerEmotionName
            );
            
            return {
              id: entry.id,
              text: entry["refined text"],
              created_at: entry.created_at,
              score: matchingKey ? entry.emotions[matchingKey] : 0
            };
          })
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 3); // Get top 3
        
        emotionHighlights = entriesWithTargetEmotion;
      }
    }
    
    return {
      overview: {
        entryCount,
        timeframe: timeRange.type || 'all time',
        topEmotions: topEmotions.slice(0, 3),
        groupedEmotions
      },
      emotionHighlights,
      allEmotions: topEmotions
    };
  } catch (error: any) {
    console.error("Error getting emotional insights:", error);
    return { error: error.message };
  }
}
