
import { detectEmotionalQuery, getEmotionAnalysisForQuery, generateEmotionContext } from './emotionQueryHandler.ts';
import { validateEntriesInDateRange, isTemporalQuery, generateNoEntriesResponse } from './dateRangeValidator.ts';

/**
 * Enhanced sub-query processor that handles emotional queries properly with conversation context
 * and validates date ranges before processing
 */
export async function processSubQueryWithEmotionSupport(
  subQuestion: string | any,
  supabase: any,
  userId: string,
  dateRange: any = null,
  openaiApiKey: string,
  conversationContext: any[] = [],
  originalQuery: string = '' // Add original query for better context
): Promise<{
  subQuestion: string;
  context: string;
  emotionResults: any[];
  vectorResults: any[];
  totalResults: number;
  hasEntriesInDateRange: boolean;
  reasoning: string;
  shouldStopProcessing?: boolean; // New flag to indicate when to stop processing
  noEntriesResponse?: string; // Response for when no entries exist in date range
}> {
  // Type validation and conversion for sub-question
  let processedSubQuestion: string;
  
  if (typeof subQuestion === 'string') {
    processedSubQuestion = subQuestion;
  } else if (typeof subQuestion === 'object' && subQuestion !== null) {
    processedSubQuestion = subQuestion.question || JSON.stringify(subQuestion);
    console.log(`[enhancedSubQueryProcessor] Converted object to string: "${processedSubQuestion}"`);
  } else {
    console.error(`[enhancedSubQueryProcessor] Invalid subQuestion type: ${typeof subQuestion}`);
    processedSubQuestion = 'Invalid question format';
  }
  
  console.log(`[enhancedSubQueryProcessor] Processing: "${processedSubQuestion}" with ${conversationContext.length} context messages`);
  
  // CRITICAL: Validate date range FIRST for temporal queries
  if (dateRange && isTemporalQuery(originalQuery || processedSubQuestion)) {
    console.log(`[enhancedSubQueryProcessor] Detected temporal query, validating date range first`);
    
    const validation = await validateEntriesInDateRange(supabase, userId, dateRange);
    
    if (!validation.hasEntries) {
      console.log(`[enhancedSubQueryProcessor] No entries found in requested date range, stopping processing`);
      
      // Determine time range description from the original query
      let timeRangeDescription = 'that time period';
      if (originalQuery.toLowerCase().includes('last week')) {
        timeRangeDescription = 'last week';
      } else if (originalQuery.toLowerCase().includes('this week')) {
        timeRangeDescription = 'this week';
      } else if (originalQuery.toLowerCase().includes('yesterday')) {
        timeRangeDescription = 'yesterday';
      } else if (originalQuery.toLowerCase().includes('last month')) {
        timeRangeDescription = 'last month';
      }
      
      const noEntriesResponse = generateNoEntriesResponse(
        originalQuery || processedSubQuestion,
        dateRange,
        timeRangeDescription
      );
      
      return {
        subQuestion: processedSubQuestion,
        context: '',
        emotionResults: [],
        vectorResults: [],
        totalResults: 0,
        hasEntriesInDateRange: false,
        reasoning: `No journal entries found in the requested time range (${dateRange.startDate} to ${dateRange.endDate})`,
        shouldStopProcessing: true,
        noEntriesResponse
      };
    }
    
    console.log(`[enhancedSubQueryProcessor] Found ${validation.entryCount} entries in date range, proceeding with analysis`);
  }
  
  // Enhanced emotion detection using conversation context
  const emotionDetection = detectEmotionalQuery(processedSubQuestion, conversationContext);
  console.log(`[enhancedSubQueryProcessor] Emotion detection (with context):`, emotionDetection);
  
  let context = '';
  let emotionResults: any[] = [];
  let vectorResults: any[] = [];
  let hasEntriesInDateRange = false;
  let reasoning = '';
  
  // If it's an emotional query, prioritize emotion analysis
  if (emotionDetection.requiresEmotionAnalysis) {
    console.log(`[enhancedSubQueryProcessor] Processing emotional query for ${emotionDetection.emotionType || 'general emotions'} with conversation context`);
    
    try {
      const emotionAnalysis = await getEmotionAnalysisForQuery(
        supabase,
        userId,
        emotionDetection.emotionType,
        dateRange,
        conversationContext
      );
      
      emotionResults = emotionAnalysis.emotions;
      const entries = emotionAnalysis.entries;
      
      if (emotionResults.length > 0 || entries.length > 0) {
        context = generateEmotionContext(
          emotionResults,
          entries,
          emotionDetection.emotionType,
          processedSubQuestion,
          conversationContext
        );
        hasEntriesInDateRange = true;
        reasoning = `Analyzed emotions and sentiment patterns from ${entries.length} journal entries with conversation context. Found ${emotionResults.length} distinct emotions.`;
      } else {
        reasoning = 'No emotional data found in journal entries.';
      }
      
      console.log(`[enhancedSubQueryProcessor] Emotion analysis completed: ${emotionResults.length} emotions, ${entries.length} entries`);
      
    } catch (error) {
      console.error('[enhancedSubQueryProcessor] Error in emotion analysis:', error);
      reasoning = 'Error occurred during emotion analysis.';
    }
  }
  
  // If emotion analysis didn't yield results, try vector search with context enhancement
  if (!hasEntriesInDateRange) {
    console.log(`[enhancedSubQueryProcessor] Falling back to vector search for: "${processedSubQuestion}" with context enhancement`);
    
    try {
      const enhancedQuery = enhanceQueryWithContext(processedSubQuestion, conversationContext);
      const queryEmbedding = await generateEmbedding(enhancedQuery, openaiApiKey);
      
      const { data: vectorData, error: vectorError } = await supabase.rpc(
        'match_journal_entries_with_date',
        {
          query_embedding: queryEmbedding,
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
        
        reasoning = `Found ${vectorData.length} relevant entries through context-enhanced semantic search.`;
      }
      
    } catch (error) {
      console.error('[enhancedSubQueryProcessor] Vector search error:', error);
    }
  }
  
  // REMOVED: Fallback searches that ignore date constraints for temporal queries
  // This was causing the incorrect behavior of analyzing entries from wrong time periods
  
  const totalResults = emotionResults.length + vectorResults.length;
  
  if (totalResults === 0) {
    context = 'No relevant journal entries found for this query.';
    reasoning = 'No journal entries found that match the query criteria.';
  }
  
  console.log(`[enhancedSubQueryProcessor] Completed processing: ${totalResults} total results with conversation context`);
  
  return {
    subQuestion: processedSubQuestion,
    context,
    emotionResults,
    vectorResults,
    totalResults,
    hasEntriesInDateRange,
    reasoning
  };
}

/**
 * Enhance query with conversation context for better semantic search
 */
function enhanceQueryWithContext(query: string, conversationContext: any[]): string {
  if (!conversationContext || conversationContext.length === 0) {
    return query;
  }
  
  const recentMessages = conversationContext.slice(-3);
  const contextTerms: string[] = [];
  
  recentMessages.forEach(msg => {
    if (msg.content) {
      const emotionMatches = msg.content.match(/\b(happy|sad|excited|anxious|content|joy|anger|fear|surprise)\b/gi);
      if (emotionMatches) {
        contextTerms.push(...emotionMatches);
      }
      
      const relevantMatches = msg.content.match(/\b(work|relationship|family|stress|sleep|health)\b/gi);
      if (relevantMatches) {
        contextTerms.push(...relevantMatches);
      }
    }
  });
  
  const uniqueTerms = [...new Set(contextTerms.map(term => term.toLowerCase()))];
  
  if (uniqueTerms.length > 0) {
    return `${query} (context: ${uniqueTerms.join(', ')})`;
  }
  
  return query;
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
