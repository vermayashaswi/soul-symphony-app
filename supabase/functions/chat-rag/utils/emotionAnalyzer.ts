
/**
 * Analyze emotions from journal entries
 */
export async function analyzeEmotions(
  supabase: any,
  userId: string,
  timeRange: { startDate?: string; endDate?: string } = null
) {
  try {
    console.log(`Analyzing emotions for user ${userId}`);
    
    // Use the get_top_emotions database function
    const { data, error } = await supabase.rpc(
      'get_top_emotions_with_entries',
      {
        user_id_param: userId,
        start_date: timeRange?.startDate || null,
        end_date: timeRange?.endDate || null,
        limit_count: 5
      }
    );
    
    if (error) {
      console.error('Error analyzing emotions:', error);
      throw error;
    }
    
    console.log(`Retrieved emotion data: ${data?.length} emotions`);
    return data || [];
  } catch (error) {
    console.error('Error in emotion analysis:', error);
    throw error;
  }
}

/**
 * Get entries with specific emotions
 */
export async function getEntriesByEmotion(
  supabase: any,
  userId: string,
  emotion: string,
  timeRange: { startDate?: string; endDate?: string } = null
) {
  try {
    console.log(`Getting entries with emotion "${emotion}" for user ${userId}`);
    
    // Use the match_journal_entries_by_emotion database function
    const { data, error } = await supabase.rpc(
      'match_journal_entries_by_emotion',
      {
        emotion_name: emotion,
        user_id_filter: userId,
        min_score: 0.3,
        start_date: timeRange?.startDate || null,
        end_date: timeRange?.endDate || null,
        limit_count: 5
      }
    );
    
    if (error) {
      console.error(`Error getting entries by emotion: ${error.message}`);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} entries with emotion "${emotion}"`);
    return data || [];
  } catch (error) {
    console.error('Error getting entries by emotion:', error);
    throw error;
  }
}
