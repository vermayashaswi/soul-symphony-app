
/**
 * Enhanced emotion query detection and handling
 */

export function detectEmotionalQuery(message: string): {
  isEmotional: boolean;
  emotionType: string | null;
  requiresEmotionAnalysis: boolean;
} {
  const lowerMessage = message.toLowerCase().trim();
  
  // Detect personal emotional queries
  const personalEmotionPatterns = [
    /\b(am|are)\s+(i|we)\s+(happy|sad|anxious|depressed|excited|content|fulfilled|joyful)\b/i,
    /\bhow\s+(happy|sad|excited|content|fulfilled|am|do)\s+(am\s+)?i\b/i,
    /\bwhat\s+(emotions?|feelings?)\s+(am\s+i|do\s+i)\b/i,
    /\b(my|our)\s+(mood|happiness|emotional?\s+state)\b/i,
    /\bhow\s+(am\s+i|do\s+i)\s+feel/i
  ];
  
  // Specific happiness indicators
  const happinessPatterns = [
    /\b(am|are)\s+(i|we)\s+happy\b/i,
    /\bhow\s+happy\s+(am\s+i|are\s+we)\b/i,
    /\b(my|our)\s+happiness\b/i,
    /\bhow\s+(content|fulfilled|satisfied)\s+(am\s+i|are\s+we)\b/i
  ];
  
  const isEmotional = personalEmotionPatterns.some(pattern => pattern.test(lowerMessage));
  const isHappinessQuery = happinessPatterns.some(pattern => pattern.test(lowerMessage));
  
  let emotionType = null;
  if (isHappinessQuery) {
    emotionType = 'happiness';
  } else if (lowerMessage.includes('sad') || lowerMessage.includes('depression')) {
    emotionType = 'sadness';
  } else if (lowerMessage.includes('anxious') || lowerMessage.includes('anxiety')) {
    emotionType = 'anxiety';
  } else if (lowerMessage.includes('excited') || lowerMessage.includes('excitement')) {
    emotionType = 'excitement';
  }
  
  return {
    isEmotional,
    emotionType,
    requiresEmotionAnalysis: isEmotional || isHappinessQuery
  };
}

export async function getEmotionAnalysisForQuery(
  supabase: any,
  userId: string,
  emotionType: string | null,
  timeRange: { startDate?: string; endDate?: string } = {}
) {
  try {
    console.log(`[emotionQueryHandler] Getting emotion analysis for user ${userId}, emotion: ${emotionType}`);
    
    // Get top emotions for the user
    const { data: emotionData, error: emotionError } = await supabase.rpc(
      'get_top_emotions_with_entries',
      {
        user_id_param: userId,
        start_date: timeRange?.startDate || null,
        end_date: timeRange?.endDate || null,
        limit_count: 10
      }
    );
    
    if (emotionError) {
      console.error('[emotionQueryHandler] Error getting emotions:', emotionError);
      return { emotions: [], entries: [] };
    }
    
    // Get entries with sentiment analysis
    const { data: entriesData, error: entriesError } = await supabase
      .from('Journal Entries')
      .select('id, transcription text, sentiment, emotions, created_at')
      .eq('user_id', userId)
      .not('transcription text', 'is', null)
      .not('transcription text', 'eq', '')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (entriesError) {
      console.error('[emotionQueryHandler] Error getting entries:', entriesError);
      return { emotions: emotionData || [], entries: [] };
    }
    
    console.log(`[emotionQueryHandler] Retrieved ${emotionData?.length || 0} emotions and ${entriesData?.length || 0} entries`);
    
    return {
      emotions: emotionData || [],
      entries: entriesData || []
    };
  } catch (error) {
    console.error('[emotionQueryHandler] Exception in emotion analysis:', error);
    return { emotions: [], entries: [] };
  }
}

export function generateEmotionContext(
  emotions: any[],
  entries: any[],
  emotionType: string | null,
  query: string
): string {
  let context = '';
  
  if (emotions.length === 0 && entries.length === 0) {
    return 'No emotional data found in journal entries.';
  }
  
  // Add emotion analysis
  if (emotions.length > 0) {
    context += '**EMOTION ANALYSIS:**\n';
    emotions.slice(0, 5).forEach(emotion => {
      const score = emotion.avg_score || emotion.score || 0;
      const count = emotion.entry_count || 1;
      context += `- ${emotion.emotion_name}: Score ${score.toFixed(3)} (appears in ${count} entries)\n`;
    });
    context += '\n';
  }
  
  // Add sentiment patterns
  if (entries.length > 0) {
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    const recentEntries = entries.slice(0, 10);
    
    recentEntries.forEach(entry => {
      if (entry.sentiment) {
        const sentiment = entry.sentiment.toLowerCase();
        if (sentiment.includes('positive')) sentimentCounts.positive++;
        else if (sentiment.includes('negative')) sentimentCounts.negative++;
        else sentimentCounts.neutral++;
      }
    });
    
    context += '**SENTIMENT ANALYSIS:**\n';
    context += `Recent entries: ${sentimentCounts.positive} positive, ${sentimentCounts.neutral} neutral, ${sentimentCounts.negative} negative\n\n`;
    
    // Add sample entries with emotions
    context += '**RELEVANT JOURNAL ENTRIES:**\n';
    recentEntries.slice(0, 5).forEach(entry => {
      const date = new Date(entry.created_at).toLocaleDateString();
      const content = entry['transcription text']?.substring(0, 200) + '...';
      context += `Entry from ${date}: ${content}\n`;
      
      if (entry.emotions && typeof entry.emotions === 'object') {
        const topEmotions = Object.entries(entry.emotions)
          .filter(([_, score]) => typeof score === 'number' && score > 0.3)
          .sort(([_, a], [__, b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([emotion, score]) => `${emotion}: ${(score as number).toFixed(2)}`)
          .join(', ');
        
        if (topEmotions) {
          context += `Emotions: ${topEmotions}\n`;
        }
      }
      context += '\n';
    });
  }
  
  return context;
}
