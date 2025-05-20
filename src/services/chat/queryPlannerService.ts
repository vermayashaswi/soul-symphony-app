import { analyzeQueryTypes } from '@/utils/chat/queryAnalyzer';
import { supabase } from '@/integrations/supabase/client';

/**
 * Enhance query with thread context
 * @param message User query message
 * @param threadId Chat thread ID
 * @returns Enhanced query string
 */
async function enhanceWithThreadContext(message: string, threadId: string, queryTypes: any): Promise<string> {
  try {
    // Fetch the last few messages from the chat thread
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('content, sender')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error fetching thread messages:", error);
      return message;
    }

    // Extract relevant context from previous messages
    const context = messages
      .filter(msg => msg.sender === 'user')
      .map(msg => msg.content)
      .join('\n');

    // Combine the user's query with the context
    const enhancedQuery = `${message}\nContext:\n${context}`;
    
    console.log("[Query Planner] Enhanced query with thread context:", enhancedQuery);
    return enhancedQuery;
  } catch (error) {
    console.error("Error enhancing query with thread context:", error);
    return message;
  }
}

/**
 * Enhanced query planning service to determine the best approach for handling user queries
 * @param message User query message
 * @param threadId Chat thread ID
 * @param userId User ID
 * @returns Query plan with strategy and parameters
 */
export async function planQuery(message: string, threadId: string, userId: string) {
  try {
    console.log("[Query Planner] Planning strategy for:", message);
    
    // Analyze the query types
    const queryTypes = analyzeQueryTypes(message);
    
    // Add properties needed by the code
    queryTypes.needsDataAggregation = queryTypes.isQuantitative || 
                                     queryTypes.isStatisticalQuery || 
                                     message.toLowerCase().includes('how many times');
                                     
    queryTypes.needsMoreContext = message.length < 10 || 
                               message.split(' ').length < 3 || 
                               /^(tell me|show)( more| about)?/i.test(message);
    
    console.log("[Query Planner] Query type analysis:", queryTypes);
    
    // Check if this is a time pattern analysis query
    const isTimePatternQuery = queryTypes.isTemporalQuery && 
                             (message.toLowerCase().includes('pattern') || 
                              message.toLowerCase().includes('when do i') || 
                              message.toLowerCase().includes('what time') || 
                              message.toLowerCase().includes('how often') || 
                              message.toLowerCase().includes('frequency'));
    
    // Enhance query analysis based on thread context
    const enhancedQuery = await enhanceWithThreadContext(message, threadId, queryTypes);
    
    // Define query plan strategy
    let strategy = 'default';
    
    if (queryTypes.needsMoreContext) {
      strategy = 'request_clarification';
    } 
    else if (isTimePatternQuery) {
      strategy = 'time_pattern_analysis';
      console.log("[Query Planner] Using time pattern analysis strategy");
    }
    else if (queryTypes.needsDataAggregation) {
      strategy = 'data_aggregation';
      console.log("[Query Planner] Using data aggregation strategy");
    }
    else if (queryTypes.isEmotionFocused) {
      strategy = 'emotion_analysis';
    }
    else if (queryTypes.isWhyQuestion) {
      strategy = 'causal_analysis';
    }
    
    // Determine if historical data should be used
    let useHistoricalData = false;
    if (message.toLowerCase().includes('historical data') || message.toLowerCase().includes('past entries')) {
      useHistoricalData = true;
    }
    
    // Determine if personal context should be used
    let usePersonalContext = false;
    if (message.toLowerCase().includes('personal context') || message.toLowerCase().includes('my feelings')) {
      usePersonalContext = true;
    }
    
    return {
      strategy,
      timeRange: queryTypes.timeRange,
      useHistoricalData: useHistoricalData,
      usePersonalContext: usePersonalContext || false,
      filterByEmotion: queryTypes.emotion || null,
      enhancedQuery,
      originalQuery: message
    };
  } catch (error) {
    console.error("[Query Planner] Error planning query:", error);
    return {
      strategy: 'default',
      originalQuery: message,
      enhancedQuery: message,
      errorState: true
    };
  }
}
