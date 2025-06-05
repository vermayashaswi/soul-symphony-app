
/**
 * Analyze emotions from journal entries using RLS-compliant functions
 */
export async function analyzeEmotions(
  supabase: any,
  timeRange: { startDate?: string; endDate?: string } = {}
) {
  try {
    console.log('Analyzing emotions with RLS-compliant function');
    
    // Use the RLS-compliant get_top_emotions_with_entries function
    const { data, error } = await supabase.rpc(
      'get_top_emotions_with_entries',
      {
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
 * Get entries with specific emotions using RLS-compliant functions
 */
export async function getEntriesByEmotion(
  supabase: any,
  emotion: string,
  timeRange: { startDate?: string; endDate?: string } = {}
) {
  try {
    console.log(`Getting entries with emotion "${emotion}" using RLS-compliant function`);
    
    // Use the RLS-compliant match_journal_entries_by_emotion function
    const { data, error } = await supabase.rpc(
      'match_journal_entries_by_emotion',
      {
        emotion_name: emotion,
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
