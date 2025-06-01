
import { detectEmotionalQuery, getEmotionAnalysisForQuery, generateEmotionContext } from './emotionQueryHandler.ts';

/**
 * Enhanced sub-query processor that handles emotional queries properly
 */
export async function processSubQueryWithEmotionSupport(
  subQuestion: string,
  supabase: any,
  userId: string,
  dateRange: any = null,
  openaiApiKey: string
): Promise<{
  subQuestion: string;
  context: string;
  emotionResults: any[];
  vectorResults: any[];
  totalResults: number;
  hasEntriesInDateRange: boolean;
  reasoning: string;
}> {
  console.log(`[enhancedSubQueryProcessor] Processing: "${subQuestion}"`);
  
  // Detect if this is an emotional query
  const emotionDetection = detectEmotionalQuery(subQuestion);
  console.log(`[enhancedSubQueryProcessor] Emotion detection:`, emotionDetection);
  
  let context = '';
  let emotionResults: any[] = [];
  let vectorResults: any[] = [];
  let hasEntriesInDateRange = false;
  let reasoning = '';
  
  // If it's an emotional query, prioritize emotion analysis
  if (emotionDetection.requiresEmotionAnalysis) {
    console.log(`[enhancedSubQueryProcessor] Processing emotional query for ${emotionDetection.emotionType || 'general emotions'}`);
    
    try {
      const emotionAnalysis = await getEmotionAnalysisForQuery(
        supabase,
        userId,
        emotionDetection.emotionType,
        dateRange
      );
      
      emotionResults = emotionAnalysis.emotions;
      const entries = emotionAnalysis.entries;
      
      if (emotionResults.length > 0 || entries.length > 0) {
        context = generateEmotionContext(
          emotionResults,
          entries,
          emotionDetection.emotionType,
          subQuestion
        );
        hasEntriesInDateRange = true;
        reasoning = `Analyzed emotions and sentiment patterns from ${entries.length} journal entries. Found ${emotionResults.length} distinct emotions.`;
      } else {
        reasoning = 'No emotional data found in journal entries.';
      }
      
      console.log(`[enhancedSubQueryProcessor] Emotion analysis completed: ${emotionResults.length} emotions, ${entries.length} entries`);
      
    } catch (error) {
      console.error('[enhancedSubQueryProcessor] Error in emotion analysis:', error);
      reasoning = 'Error occurred during emotion analysis.';
    }
  }
  
  // If emotion analysis didn't yield results, try vector search
  if (!hasEntriesInDateRange) {
    console.log(`[enhancedSubQueryProcessor] Falling back to vector search for: "${subQuestion}"`);
    
    try {
      // Perform vector search
      const { data: vectorData, error: vectorError } = await supabase.rpc(
        'match_journal_entries',
        {
          query_embedding: await generateEmbedding(subQuestion, openaiApiKey),
          match_threshold: 0.1,
          match_count: 10,
          user_id_filter: userId,
          start_date: dateRange?.startDate || null,
          end_date: dateRange?.endDate || null
        }
      );
      
      if (vectorError) {
        console.error('[enhancedSubQueryProcessor] Vector search error:', vectorError);
      } else if (vectorData && vectorData.length > 0) {
        vectorResults = vectorData;
        hasEntriesInDateRange = true;
        
        // Generate context from vector results
        context += '**RELEVANT JOURNAL ENTRIES:**\n';
        vectorData.slice(0, 5).forEach((entry: any) => {
          const date = new Date(entry.created_at).toLocaleDateString();
          const content = entry.content?.substring(0, 200) + '...';
          context += `Entry from ${date} (similarity: ${entry.similarity?.toFixed(3)}): ${content}\n\n`;
        });
        
        reasoning = `Found ${vectorData.length} relevant entries through semantic search.`;
      }
      
    } catch (error) {
      console.error('[enhancedSubQueryProcessor] Vector search error:', error);
    }
  }
  
  // If still no results, try a broader search
  if (!hasEntriesInDateRange) {
    console.log(`[enhancedSubQueryProcessor] Trying broader search for recent entries`);
    
    try {
      const { data: recentEntries, error: recentError } = await supabase
        .from('Journal Entries')
        .select('id, transcription text, emotions, sentiment, created_at')
        .eq('user_id', userId)
        .not('transcription text', 'is', null)
        .not('transcription text', 'eq', '')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (recentError) {
        console.error('[enhancedSubQueryProcessor] Recent entries error:', recentError);
      } else if (recentEntries && recentEntries.length > 0) {
        vectorResults = recentEntries;
        hasEntriesInDateRange = true;
        
        context += '**RECENT JOURNAL ENTRIES:**\n';
        recentEntries.forEach((entry: any) => {
          const date = new Date(entry.created_at).toLocaleDateString();
          const content = entry['transcription text']?.substring(0, 200) + '...';
          context += `Entry from ${date}: ${content}\n\n`;
        });
        
        reasoning = `Using ${recentEntries.length} recent journal entries as no specific matches were found.`;
      }
      
    } catch (error) {
      console.error('[enhancedSubQueryProcessor] Recent entries error:', error);
    }
  }
  
  const totalResults = emotionResults.length + vectorResults.length;
  
  if (totalResults === 0) {
    context = 'No relevant journal entries found for this query.';
    reasoning = 'No journal entries found that match the query criteria.';
  }
  
  console.log(`[enhancedSubQueryProcessor] Completed processing: ${totalResults} total results`);
  
  return {
    subQuestion,
    context,
    emotionResults,
    vectorResults,
    totalResults,
    hasEntriesInDateRange,
    reasoning
  };
}

async function generateEmbedding(text: string, openaiApiKey: string): Promise<number[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float'
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}
