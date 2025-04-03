
// Emotion analytics for the chat-with-rag function

export async function getEmotionInsights(
  supabase: any, 
  userId: string, 
  emotion: string, 
  timeRange: { type: string | null, startDate: string | null, endDate: string | null }
) {
  try {
    // Define the query parameters
    const params = [userId];
    let timeFilterClause = "";
    
    // Add time range conditions if present
    if (timeRange.startDate) {
      timeFilterClause += " AND created_at >= $2";
      params.push(timeRange.startDate);
    }
    
    if (timeRange.endDate) {
      timeFilterClause += ` AND created_at <= $${params.length + 1}`;
      params.push(timeRange.endDate);
    }
    
    // Get entries with the specified emotion
    const { data: entries, error } = await supabase.rpc(
      'match_journal_entries_by_emotion_strength',
      {
        emotion_name: emotion,
        user_id_filter: userId,
        match_count: 5,
        start_date: timeRange.startDate,
        end_date: timeRange.endDate
      }
    );
    
    if (error) throw error;
    
    // Calculate emotion frequency
    const { data: emotionStats, error: statsError } = await supabase.rpc(
      'get_top_emotions',
      {
        user_id_param: userId,
        start_date: timeRange.startDate,
        end_date: timeRange.endDate
      }
    );
    
    if (statsError) throw statsError;
    
    // Get total entry count for the period
    const { count, error: countError } = await supabase
      .from('Journal Entries')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .filter('created_at', 'gte', timeRange.startDate || '')
      .filter('created_at', 'lte', timeRange.endDate || '');
    
    if (countError) throw countError;
    
    // Find rank of the requested emotion
    const allEmotions = emotionStats || [];
    const rankIndex = allEmotions.findIndex((e: any) => e.emotion === emotion);
    const rank = rankIndex !== -1 ? rankIndex + 1 : null;
    
    // Find the emotion's score
    const emotionData = allEmotions.find((e: any) => e.emotion === emotion);
    const score = emotionData ? emotionData.score : null;
    
    // Calculate percentage of entries with this emotion
    const entriesWithEmotion = entries?.length || 0;
    const totalEntries = count || 0;
    const percentage = totalEntries > 0 
      ? Math.round((entriesWithEmotion / totalEntries) * 100) 
      : 0;
      
    // Format sample entries
    const formattedEntries = entries?.map((entry: any) => ({
      id: entry.id,
      text: entry.content,
      score: entry.emotion_score,
      date: entry.created_at
    })) || [];
    
    return {
      emotion,
      entries: formattedEntries,
      frequency: {
        totalEntries,
        entriesWithEmotion,
        percentage,
        rank,
        score
      }
    };
  } catch (error) {
    console.error("Error in getEmotionInsights:", error);
    return { 
      emotion, 
      entries: [], 
      error: (error as Error).message,
      frequency: {
        totalEntries: 0,
        entriesWithEmotion: 0,
        percentage: 0
      }
    };
  }
}
