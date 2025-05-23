import { analyzeQueryTypes } from '@/utils/chat/queryAnalyzer';
import { supabase } from '@/integrations/supabase/client';
import { 
  isDirectDateQuery, 
  getClientTimeInfo, 
  getLastWeekDateRange, 
  getCurrentWeekDateRange, 
  debugTimezoneInfo, 
  ClientTimeInfo 
} from '@/services/dateService';

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
 * Enhanced query planning service with intelligent sub-query generation
 */
export async function planQuery(message: string, threadId: string, userId: string) {
  try {
    console.log("[Query Planner] Planning intelligent sub-query strategy for:", message);
    console.log(`[Query Planner] Current time: ${new Date().toISOString()}`);
    
    // For debugging timezone issues
    if (message.toLowerCase().includes('debug timezone')) {
      debugTimezoneInfo();
    }
    
    // Get client's device time information for accurate date calculations
    const clientInfo: ClientTimeInfo = getClientTimeInfo();
    
    console.log(`[Query Planner] Client time information:`, clientInfo);
    
    // Get user's timezone from their profile
    let userTimezone;
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', userId)
        .single();
        
      if (profileData && profileData.timezone) {
        userTimezone = profileData.timezone;
        console.log(`[Query Planner] User timezone from profile: ${userTimezone}`);
      } else {
        console.log(`[Query Planner] No timezone found in user profile, using client timezone`);
        userTimezone = clientInfo.timezoneName;
      }
    } catch (error) {
      console.error("Error fetching user timezone from profile:", error);
      userTimezone = clientInfo.timezoneName;
    }
    
    // Check if this is a direct date query
    const isLastWeekQuery = message.toLowerCase().includes('last week') && 
                           (message.toLowerCase().includes('date') || 
                            message.toLowerCase().includes('what') || 
                            message.toLowerCase().includes('when'));
                           
    const isCurrentWeekQuery = isDirectDateQuery(message);
    
    if (isCurrentWeekQuery || isLastWeekQuery) {
      console.log("[Query Planner] Detected direct date query:", isLastWeekQuery ? "last week" : "current week");
      
      let dateResponse, dateRange;
      
      if (isLastWeekQuery) {
        const lastWeekResult = getLastWeekDateRange(clientInfo, userTimezone);
        dateResponse = lastWeekResult.formattedRange;
        dateRange = lastWeekResult.rangeObj;
        console.log(`[Query Planner] Last week dates calculated: ${dateResponse}`);
      } else {
        const currentWeekResult = getCurrentWeekDateRange(clientInfo, userTimezone);
        dateResponse = currentWeekResult.formattedRange;
        dateRange = currentWeekResult.rangeObj;
        console.log(`[Query Planner] Current week dates calculated: ${dateResponse}`);
      }
      
      return {
        strategy: "direct_date",
        isDirectDateQuery: true,
        timeRange: dateRange,
        useHistoricalData: false,
        usePersonalContext: false,
        filterByEmotion: null,
        enhancedQuery: message,
        originalQuery: message,
        timestamp: new Date().toISOString(),
        clientDeviceTime: clientInfo.timestamp,
        clientTimezone: clientInfo.timezoneName,
        clientTimezoneOffset: clientInfo.timezoneOffset,
        userTimezone: userTimezone,
        dateResponse: dateResponse
      };
    }
    
    // Analyze the query types for intelligent sub-query planning
    const queryTypes = analyzeQueryTypes(message);
    
    // Add properties needed for intelligent planning
    queryTypes.needsDataAggregation = queryTypes.isQuantitative || 
                                     queryTypes.isStatisticalQuery || 
                                     message.toLowerCase().includes('how many times');
                                     
    queryTypes.needsMoreContext = message.length < 10 || 
                               message.split(' ').length < 3 || 
                               /^(tell me|show)( more| about)?/i.test(message);
    
    console.log("[Query Planner] Query type analysis for sub-query planning:", queryTypes);
    
    // Check if this is a time pattern analysis query
    const isTimePatternQuery = queryTypes.isTemporalQuery && 
                             (message.toLowerCase().includes('pattern') || 
                              message.toLowerCase().includes('when do i') || 
                              message.toLowerCase().includes('what time') || 
                              message.toLowerCase().includes('how often') || 
                              message.toLowerCase().includes('frequency'));
    
    // Enhance query analysis based on thread context
    const enhancedQuery = await enhanceWithThreadContext(message, threadId, queryTypes);
    
    // Define intelligent sub-query strategy
    let strategy = 'intelligent_sub_query'; // Default to intelligent sub-query planning
    
    if (queryTypes.needsMoreContext) {
      strategy = 'request_clarification';
    } 
    else if (isTimePatternQuery) {
      strategy = 'intelligent_sub_query'; // Use sub-query planning for time patterns
      console.log("[Query Planner] Using intelligent sub-query strategy for time pattern analysis");
    }
    else if (queryTypes.needsDataAggregation) {
      strategy = 'intelligent_sub_query'; // Use sub-query planning for data aggregation
      console.log("[Query Planner] Using intelligent sub-query strategy for data aggregation");
    }
    else if (queryTypes.isEmotionFocused) {
      strategy = 'intelligent_sub_query'; // Use sub-query planning for emotion analysis
      console.log("[Query Planner] Using intelligent sub-query strategy for emotion analysis");
    }
    else if (queryTypes.isWhyQuestion) {
      strategy = 'intelligent_sub_query'; // Use sub-query planning for causal analysis
      console.log("[Query Planner] Using intelligent sub-query strategy for causal analysis");
    }
    
    // Return plan that will trigger intelligent sub-query generation
    return {
      strategy,
      timeRange: queryTypes.timeRange,
      useHistoricalData: false, // Sub-query planner will determine this
      usePersonalContext: true, // Always use personal context for sub-query planning
      filterByEmotion: queryTypes.emotion || null,
      enhancedQuery,
      originalQuery: message,
      timestamp: new Date().toISOString(),
      clientDeviceTime: clientInfo.timestamp,
      clientTimezone: clientInfo.timezoneName,
      clientTimezoneOffset: clientInfo.timezoneOffset,
      userTimezone: userTimezone,
      requiresIntelligentPlanning: true, // Flag to trigger sub-query generation
      queryComplexity: queryTypes.needsDataAggregation ? 'high' : 
                      queryTypes.isEmotionFocused ? 'medium' : 'standard'
    };
  } catch (error) {
    console.error("[Query Planner] Error planning intelligent sub-query:", error);
    return {
      strategy: 'intelligent_sub_query', // Default to intelligent planning even on error
      originalQuery: message,
      enhancedQuery: message,
      errorState: true,
      timestamp: new Date().toISOString(),
      requiresIntelligentPlanning: true
    };
  }
}
